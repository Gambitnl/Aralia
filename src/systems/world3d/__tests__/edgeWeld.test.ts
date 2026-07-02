/**
 * @file edgeWeld.test.ts
 * @description Chunk seam watertightness across LOD tiers (grid-crack fix, 2026-07-02).
 *
 * Neighboring chunks build at different mesh resolutions (LOD tiers). Because the
 * tiers sample the shared height field at different edge densities, their border
 * polylines used to diverge between corners — a real T-junction crack the skirt
 * could not hide in the flat-shaded art style (front-side-only material shows sky
 * through the gap from the high side; where visible, the vertical skirt reads as a
 * dark groove). The fix welds every chunk's border-vertex heights onto the
 * piecewise-linear curve through the 5 anchor vertices ALL tiers share
 * (t = 0, 1/4, 1/2, 3/4, 1 along each edge), so ANY two neighbors — any tier mix,
 * fresh or stale — emit bit-identical seam curves. These tests sample chunks from
 * one continuous field exactly like the samplers do (vertex i at t = i/(res-1))
 * and assert the built terrain edges coincide.
 */
import { describe, it, expect } from 'vitest';
import { buildChunkBundle } from '../chunkBundle';
import { WORLD3D_CONFIG, resolutionForLod } from '../config';
import type { ChunkData } from '../types';
import type { LodTier } from '../types';

const S = WORLD3D_CONFIG.CHUNK_WORLD_SIZE;

/** Deterministic bumpy height field (0..100 domain) over world meters. */
function fieldHeight(wxM: number, wzM: number): number {
  return (
    50 +
    20 * Math.sin(wxM * 0.113) * Math.cos(wzM * 0.071) +
    15 * Math.sin((wxM + wzM) * 0.0237) +
    8 * Math.cos(wxM * 0.031 - wzM * 0.047)
  );
}

/** Mimics the samplers' vertex placement contract: vertex (i,j) samples the
 * shared field at world meters ((cx + i/(res-1))·S, (cy + j/(res-1))·S). */
function chunkFromField(cx: number, cy: number, res: number): ChunkData {
  const heights = new Float32Array(res * res);
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const wx = (cx + (res === 1 ? 0 : i / (res - 1))) * S;
      const wz = (cy + (res === 1 ? 0 : j / (res - 1))) * S;
      heights[j * res + i] = fieldHeight(wx, wz);
    }
  }
  return {
    cx,
    cy,
    resolution: res,
    heights,
    biomeIds: new Array<string>(res * res).fill('plains'),
    rivers: [],
    roads: [],
    sites: [],
  };
}

/** Base-grid vertex Y at (i, j) from the built terrain (skirt verts come after). */
function terrainY(positions: Float32Array, res: number, i: number, j: number): number {
  return positions[(j * res + i) * 3 + 1];
}

/** The chunk-local east edge (x = S) as (t, y) samples, t = z/S in [0, 1]. */
function eastEdge(positions: Float32Array, res: number): Array<{ t: number; y: number }> {
  const out: Array<{ t: number; y: number }> = [];
  for (let j = 0; j < res; j++) out.push({ t: j / (res - 1), y: terrainY(positions, res, res - 1, j) });
  return out;
}

/** The chunk-local west edge (x = 0) as (t, y) samples. */
function westEdge(positions: Float32Array, res: number): Array<{ t: number; y: number }> {
  const out: Array<{ t: number; y: number }> = [];
  for (let j = 0; j < res; j++) out.push({ t: j / (res - 1), y: terrainY(positions, res, 0, j) });
  return out;
}

/** Piecewise-linear evaluation of an edge polyline at parameter t. */
function edgeYAt(edge: Array<{ t: number; y: number }>, t: number): number {
  for (let k = 0; k < edge.length - 1; k++) {
    const a = edge[k];
    const b = edge[k + 1];
    if (t >= a.t - 1e-9 && t <= b.t + 1e-9) {
      const span = b.t - a.t;
      const f = span === 0 ? 0 : (t - a.t) / span;
      return a.y + (b.y - a.y) * f;
    }
  }
  return edge[edge.length - 1].y;
}

/** Max |Δy| between two neighbors' shared seam curves, evaluated at a fine param sweep. */
function seamMaxGap(tierA: LodTier, tierB: LodTier): number {
  const resA = resolutionForLod(tierA);
  const resB = resolutionForLod(tierB);
  const a = buildChunkBundle(chunkFromField(0, 0, resA));
  const b = buildChunkBundle(chunkFromField(1, 0, resB));
  const east = eastEdge(a.terrain.positions, resA);
  const west = westEdge(b.terrain.positions, resB);
  let max = 0;
  for (let k = 0; k <= 256; k++) {
    const t = k / 256;
    max = Math.max(max, Math.abs(edgeYAt(east, t) - edgeYAt(west, t)));
  }
  return max;
}

describe('LOD tier nesting (config)', () => {
  it('every tier edge divides into the shared 4-segment anchor basis', () => {
    for (const tier of ['full', 'mid', 'low'] as const) {
      const res = resolutionForLod(tier);
      expect((res - 1) % 4, `tier ${tier} (res ${res}) must nest into 4 anchor segments`).toBe(0);
    }
  });
});

describe('chunk seam watertightness across LOD tiers', () => {
  it('full ↔ mid neighbors share a bit-identical seam curve', () => {
    expect(seamMaxGap('full', 'mid')).toBeLessThan(1e-3);
  });

  it('full ↔ low neighbors share a bit-identical seam curve', () => {
    expect(seamMaxGap('full', 'low')).toBeLessThan(1e-3);
  });

  it('mid ↔ low neighbors share a bit-identical seam curve', () => {
    expect(seamMaxGap('mid', 'low')).toBeLessThan(1e-3);
  });

  it('same-tier neighbors stay watertight (regression guard)', () => {
    expect(seamMaxGap('full', 'full')).toBeLessThan(1e-3);
    expect(seamMaxGap('low', 'low')).toBeLessThan(1e-3);
  });

  it('welding preserves the anchor vertices (corners + quarter points) exactly', () => {
    const res = resolutionForLod('full');
    const bundle = buildChunkBundle(chunkFromField(0, 0, res));
    const edge = eastEdge(bundle.terrain.positions, res);
    // Anchors sample the true field: heightToMeters is linear in the encoded
    // height, so compare against a low-tier build whose edge verts are all anchors.
    const lowRes = resolutionForLod('low');
    const low = buildChunkBundle(chunkFromField(0, 0, lowRes));
    const lowEdge = eastEdge(low.terrain.positions, lowRes);
    for (const anchor of lowEdge) {
      expect(Math.abs(edgeYAt(edge, anchor.t) - anchor.y)).toBeLessThan(1e-3);
    }
  });
});
