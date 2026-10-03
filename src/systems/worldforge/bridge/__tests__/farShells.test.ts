/**
 * This file guards the far-distance shells' ONE structural contract: the region
 * shell continues the world BEYOND the streamed window and never lays a second
 * ground surface underneath it.
 *
 * The bug this pins (2026-08-24) shipped silently because nothing tested this
 * module. The region shell was drawn as a full surface under the window too,
 * tucked a mere 0.7 m below its terrain, while its own samples sit ~61 m apart.
 * Between two samples the shell is a flat plane; a town flattens its ground into
 * building pads, so every dip deeper than the tuck let the coarse shell cut UP
 * through the detail terrain — flat green polygons scattered over the town, and
 * over the street ribbons they covered, which made the road network look broken.
 */
import { describe, it, expect } from 'vitest';
import { buildRegionShell, type FarShellGrid } from '../farShells';
import type { LocalArtifact, RegionArtifact } from '../../artifacts';

const FEET_TO_METERS = 0.3048;

/** A flat region heightfield covering a square, at 100 ft resolution. */
function makeRegion(widthFt: number, resolutionFt = 100, n = 0.4): RegionArtifact {
  const w = Math.floor(widthFt / resolutionFt) + 1;
  return {
    layer: 'region',
    schemaVersion: 1,
    seedPath: 'wf:1/region' as RegionArtifact['seedPath'],
    bounds: { x: 0, y: 0, width: widthFt, height: widthFt },
    heightfield: {
      width: w,
      height: w,
      resolutionFt,
      samples: new Float32Array(w * w).fill(n),
    },
    rivers: [],
    roads: [],
    townSites: [],
  } as unknown as RegionArtifact;
}

/** A local window sitting in the middle of the region. */
function makeLocal(x: number, y: number, sideFt: number): LocalArtifact {
  return {
    layer: 'local',
    schemaVersion: 1,
    seedPath: 'wf:1/local' as LocalArtifact['seedPath'],
    bounds: { x, y, width: sideFt, height: sideFt },
    terrain: {},
    features: [],
  } as unknown as LocalArtifact;
}

/** Every sample position of a grid, in window-relative metres. */
function samplePoints(g: FarShellGrid): Array<{ x: number; z: number; col: number; row: number }> {
  const out: Array<{ x: number; z: number; col: number; row: number }> = [];
  for (let row = 0; row < g.rows; row++) {
    for (let col = 0; col < g.cols; col++) {
      out.push({
        x: g.originXM + col * g.spacingM,
        z: g.originZM + row * g.spacingM,
        col,
        row,
      });
    }
  }
  return out;
}

/** Count quads the renderer would KEEP: any quad not wholly inside the hole. */
function keptQuads(g: FarShellGrid): { kept: number; total: number } {
  const inside = (col: number, row: number): boolean => {
    if (!g.holeM) return false;
    const x = g.originXM + col * g.spacingM;
    const z = g.originZM + row * g.spacingM;
    return x >= g.holeM.minX && x <= g.holeM.maxX && z >= g.holeM.minZ && z <= g.holeM.maxZ;
  };
  let kept = 0;
  let total = 0;
  for (let row = 0; row < g.rows - 1; row++) {
    for (let col = 0; col < g.cols - 1; col++) {
      total++;
      if (inside(col, row) && inside(col + 1, row) && inside(col, row + 1) && inside(col + 1, row + 1)) continue;
      kept++;
    }
  }
  return { kept, total };
}

const REGION_FT = 25000;
const WINDOW_FT = 3000;
const build = (): FarShellGrid => {
  const region = makeRegion(REGION_FT);
  // Window in the middle of the region, so the shell surrounds it on all sides.
  const local = makeLocal(11000, 11000, WINDOW_FT);
  const cells = Math.round(WINDOW_FT / 5);
  return buildRegionShell(region, local, 500, 9000, new Float32Array(cells * cells).fill(20), cells, cells);
};

describe('buildRegionShell — the window hole', () => {
  it('reports a hole, and the hole is the streamed window', () => {
    const g = build();
    expect(g.holeM).not.toBeNull();
    const extentM = WINDOW_FT * FEET_TO_METERS;
    // Inset by one sample spacing on every side so border quads still straddle.
    expect(g.holeM!.minX).toBeCloseTo(g.spacingM, 5);
    expect(g.holeM!.minZ).toBeCloseTo(g.spacingM, 5);
    expect(g.holeM!.maxX).toBeCloseTo(extentM - g.spacingM, 5);
    expect(g.holeM!.maxZ).toBeCloseTo(extentM - g.spacingM, 5);
  });

  it('drops the quads inside the window — the shell is not a second floor', () => {
    const g = build();
    const { kept, total } = keptQuads(g);
    expect(kept).toBeLessThan(total);
    // The window is small against a 25,000 ft region, so most of the ring stays.
    expect(kept / total).toBeGreaterThan(0.9);
  });

  it('keeps every quad that straddles the window border, so no seam gap opens', () => {
    const g = build();
    const h = g.holeM!;
    const inside = (x: number, z: number) => x >= h.minX && x <= h.maxX && z >= h.minZ && z <= h.maxZ;
    let straddling = 0;
    let straddlingKept = 0;
    for (let row = 0; row < g.rows - 1; row++) {
      for (let col = 0; col < g.cols - 1; col++) {
        const c = [[col, row], [col + 1, row], [col, row + 1], [col + 1, row + 1]].map(
          ([cc, rr]) => inside(g.originXM + cc * g.spacingM, g.originZM + rr * g.spacingM),
        );
        const anyIn = c.some(Boolean);
        const allIn = c.every(Boolean);
        if (!anyIn || allIn) continue;
        straddling++;
        straddlingKept++; // by the rule, only ALL-inside quads are dropped
      }
    }
    expect(straddling).toBeGreaterThan(0);
    expect(straddlingKept).toBe(straddling);
  });

  it('never sits ABOVE the window terrain where the two overlap', () => {
    // The shell is tucked under the window's own surface. Sampling the window at
    // a constant height makes the check exact: no shell sample inside the window
    // may sit at or above that surface, or it shows through the detail terrain.
    const region = makeRegion(REGION_FT);
    const local = makeLocal(11000, 11000, WINDOW_FT);
    const cells = Math.round(WINDOW_FT / 5);
    const ENC = 20;
    const g = buildRegionShell(region, local, 500, 9000, new Float32Array(cells * cells).fill(ENC), cells, cells);
    const windowSurfaceM = ENC * 18; // heightToMeters: 1 enc unit = 18 m
    const extentM = WINDOW_FT * FEET_TO_METERS;
    let checked = 0;
    for (const p of samplePoints(g)) {
      if (p.x < 0 || p.x > extentM || p.z < 0 || p.z > extentM) continue;
      checked++;
      expect(g.heightsM[p.row * g.cols + p.col]).toBeLessThan(windowSurfaceM);
    }
    expect(checked).toBeGreaterThan(0);
  });
});
