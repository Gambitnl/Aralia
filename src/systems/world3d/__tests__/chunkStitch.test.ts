/**
 * @file chunkStitch.test.ts
 * @description Border index-stitching (dotted-hairline fix, 2026-07-02).
 *
 * After the edge weld, every chunk's border POLYLINE is watertight across LOD
 * tiers — but the border TRIANGULATION was not: a finer chunk kept T-vertices
 * lying on a coarser neighbour's long triangle edge. The GPU interpolates clip
 * coordinates along the long edge, while the T-vertex is transformed directly;
 * the two disagree in the last ulp, and the rasterizer leaks a faint DOTTED
 * hairline of background pixels along chunk borders. The fix triangulates each
 * chunk's outer ring against ONLY the 5 shared anchor vertices per edge
 * (t = 0, ¼, ½, ¾, 1), so every tier emits the exact same 4-segment border
 * edges and no T-vertex exists anywhere on a seam.
 *
 * These tests verify the stitched triangulation is watertight and correctly
 * oriented, that border edges use only anchor vertices, that the skirt hangs
 * from the anchor ring (so it can't reintroduce T-vertices against the
 * terrain's own border edge), and that two rebased neighbours share
 * bit-identical seam vertices (the shared-transform half of the fix).
 */
import { describe, it, expect } from 'vitest';
import { buildTerrainMesh, baseTriangleCount, skirtVertexCount, SKIRT_TOP_DROP_M } from '../chunkGeometry';
import { rebaseChunkPositions } from '../chunkRebase';
import { buildChunkBundle } from '../chunkBundle';
import { WORLD3D_CONFIG, resolutionForLod } from '../config';
import type { ChunkData, LodTier } from '../types';

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

const TIERS: LodTier[] = ['full', 'mid', 'low'];

/** Base-surface triangles only (the skirt's triangles follow them). */
function baseTriangles(indices: Uint32Array, res: number): number[][] {
  const count = baseTriangleCount(res);
  const tris: number[][] = [];
  for (let t = 0; t < count; t++) {
    tris.push([indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]]);
  }
  return tris;
}

describe('stitched border triangulation', () => {
  it('base-surface triangles touch the chunk border only at anchor vertices', () => {
    for (const tier of TIERS) {
      const res = resolutionForLod(tier);
      const q = (res - 1) / 4;
      const mesh = buildTerrainMesh(chunkFromField(0, 0, res));
      for (const tri of baseTriangles(mesh.indices, res)) {
        for (const v of tri) {
          const i = v % res;
          const j = Math.floor(v / res);
          const onBorder = i === 0 || i === res - 1 || j === 0 || j === res - 1;
          if (onBorder) {
            expect(i % q, `tier ${tier}: border vertex (${i},${j}) must be an anchor`).toBe(0);
            expect(j % q, `tier ${tier}: border vertex (${i},${j}) must be an anchor`).toBe(0);
          }
        }
      }
    }
  });

  it('is watertight: interior edges shared by exactly 2 triangles, boundary edges are anchor-to-anchor', () => {
    for (const tier of TIERS) {
      const res = resolutionForLod(tier);
      const q = (res - 1) / 4;
      const mesh = buildTerrainMesh(chunkFromField(0, 0, res));
      const edgeCount = new Map<string, number>();
      for (const [a, b, c] of baseTriangles(mesh.indices, res)) {
        for (const [u, v] of [[a, b], [b, c], [c, a]]) {
          const key = u < v ? `${u}|${v}` : `${v}|${u}`;
          edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
        }
      }
      for (const [key, count] of edgeCount) {
        expect(count, `tier ${tier}: edge ${key} used ${count} times`).toBeLessThanOrEqual(2);
        if (count === 1) {
          // Every open edge must be one of the 16 anchor-to-anchor border segments.
          const [u, v] = key.split('|').map(Number);
          for (const w of [u, v]) {
            const i = w % res;
            const j = Math.floor(w / res);
            const onBorder = i === 0 || i === res - 1 || j === 0 || j === res - 1;
            expect(onBorder, `tier ${tier}: open edge ${key} must lie on the border`).toBe(true);
            expect(i % q).toBe(0);
            expect(j % q).toBe(0);
          }
        }
      }
      const openEdges = [...edgeCount.values()].filter((c) => c === 1).length;
      expect(openEdges, `tier ${tier}: 16 anchor border segments`).toBe(16);
    }
  });

  it('covers the full chunk area exactly once with consistent winding', () => {
    for (const tier of TIERS) {
      const res = resolutionForLod(tier);
      const mesh = buildTerrainMesh(chunkFromField(0, 0, res));
      let total = 0;
      for (const [a, b, c] of baseTriangles(mesh.indices, res)) {
        const ax = mesh.positions[a * 3], az = mesh.positions[a * 3 + 2];
        const bx = mesh.positions[b * 3], bz = mesh.positions[b * 3 + 2];
        const cx = mesh.positions[c * 3], cz = mesh.positions[c * 3 + 2];
        const signed = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
        // Same orientation as the uniform grid quads (negative XZ signed area).
        expect(signed, `tier ${tier}: degenerate or flipped triangle`).toBeLessThan(0);
        total += Math.abs(signed) / 2;
      }
      expect(total).toBeCloseTo(S * S, 3);
    }
  });

  it('hangs a DETACHED skirt from the anchor ring, strictly below the surface', () => {
    for (const tier of TIERS) {
      const res = resolutionForLod(tier);
      const q = (res - 1) / 4;
      const spacing = S / (res - 1);
      const mesh = buildTerrainMesh(chunkFromField(0, 0, res));
      const skirtCount = skirtVertexCount(res);
      expect(skirtCount).toBe(32); // own top ring (16) + bottom ring (16)
      const base = res * res;
      // Surface height lookup by border position, for the drop assertions.
      const surfaceYAt = new Map<string, number>();
      for (let v = 0; v < base; v++) {
        surfaceYAt.set(`${mesh.positions[v * 3]}|${mesh.positions[v * 3 + 2]}`, mesh.positions[v * 3 + 1]);
      }
      for (let k = 0; k < skirtCount; k++) {
        const x = mesh.positions[(base + k) * 3];
        const y = mesh.positions[(base + k) * 3 + 1];
        const z = mesh.positions[(base + k) * 3 + 2];
        // Anchor positions are multiples of q*spacing along each border.
        expect(x % (q * spacing), `tier ${tier}: skirt vert ${k} x`).toBe(0);
        expect(z % (q * spacing), `tier ${tier}: skirt vert ${k} z`).toBe(0);
        // The wall never touches the surface: top ring sits SKIRT_TOP_DROP_M
        // below it (so it loses every depth tie instead of z-fighting the
        // neighbour's surface into dotted hairlines), bottom ring deeper still.
        const surfaceY = surfaceYAt.get(`${x}|${z}`)!;
        const expectedDrop = k < 16 ? SKIRT_TOP_DROP_M : WORLD3D_CONFIG.SKIRT_MIN_DEPTH_M;
        expect(surfaceY - y, `tier ${tier}: skirt vert ${k} drop`).toBeGreaterThanOrEqual(expectedDrop - 1e-6);
      }
    }
  });
});

describe('shared-transform rebase (bit-identical seam vertices)', () => {
  it('rebased neighbours emit bit-identical positions for shared border anchors', () => {
    for (const [tierA, tierB] of [
      ['full', 'full'],
      ['full', 'mid'],
      ['full', 'low'],
      ['mid', 'low'],
    ] as Array<[LodTier, LodTier]>) {
      const resA = resolutionForLod(tierA);
      const resB = resolutionForLod(tierB);
      // Neighbours far from the anchor chunk, like a streamed window far from spawn.
      const a = buildChunkBundle(chunkFromField(37, -12, resA));
      const b = buildChunkBundle(chunkFromField(38, -12, resB));
      const anchor = { cx: 35, cy: -14 };
      const posA = rebaseChunkPositions(a.terrain.positions, 37 - anchor.cx, -12 - anchor.cy);
      const posB = rebaseChunkPositions(b.terrain.positions, 38 - anchor.cx, -12 - anchor.cy);
      // Shared seam: A's east edge (i = resA-1) at anchor rows == B's west edge (i = 0).
      for (let k = 0; k <= 4; k++) {
        const jA = (k * (resA - 1)) / 4;
        const jB = (k * (resB - 1)) / 4;
        const vA = (jA * resA + (resA - 1)) * 3;
        const vB = (jB * resB + 0) * 3;
        for (const d of [0, 1, 2]) {
          expect(
            Object.is(posA[vA + d], posB[vB + d]),
            `${tierA}/${tierB} anchor ${k} component ${d}: ${posA[vA + d]} vs ${posB[vB + d]}`,
          ).toBe(true);
        }
      }
    }
  });

  it('rebase leaves the source array untouched and offsets by exact chunk multiples', () => {
    const res = resolutionForLod('low');
    const bundle = buildChunkBundle(chunkFromField(0, 0, res));
    const before = bundle.terrain.positions.slice();
    const rebased = rebaseChunkPositions(bundle.terrain.positions, 3, -2);
    expect(bundle.terrain.positions).toEqual(before);
    expect(rebased[0]).toBe(before[0] + 3 * S);
    expect(rebased[1]).toBe(before[1]);
    expect(rebased[2]).toBe(before[2] + -2 * S);
  });
});
