/**
 * Open-region seam-first slice (2026-07-01): two L2 LocalArtifacts generated
 * from DIFFERENT regions must stitch into one wider artifact so the 3D ground
 * loader can render a region→region boundary as a single continuous surface.
 * The stitcher is pure array surgery — any height cliff at the join must come
 * from the generators (that's what the visual proof inspects), never from the
 * stitch itself.
 */
import { describe, expect, it } from 'vitest';
import type { LocalArtifact, TerrainMaterial } from '../../artifacts';
import { WORLDFORGE_SCHEMA_VERSION } from '../../artifacts';
import { rootSeedPath } from '../../seedPath';
import { CELL_FT } from '../../units';
import { stitchLocalsEastWest } from '../stitchLocalArtifacts';

/** Build a synthetic W×H-cell locale at (xFt, yFt) with per-cell values. */
function makeLocale(
  xFt: number,
  yFt: number,
  widthCells: number,
  heightCells: number,
  materials: TerrainMaterial[],
  elevAt: (cx: number, cy: number) => number,
  matAt: (cx: number, cy: number) => number,
  features: LocalArtifact['features'] = [],
): LocalArtifact {
  const n = widthCells * heightCells;
  const elevationFt = new Float32Array(n);
  const materialIndex = new Uint8Array(n);
  for (let cy = 0; cy < heightCells; cy++) {
    for (let cx = 0; cx < widthCells; cx++) {
      elevationFt[cy * widthCells + cx] = elevAt(cx, cy);
      materialIndex[cy * widthCells + cx] = matAt(cx, cy);
    }
  }
  return {
    layer: 'local',
    schemaVersion: WORLDFORGE_SCHEMA_VERSION,
    seedPath: rootSeedPath(42),
    bounds: {
      x: xFt,
      y: yFt,
      width: widthCells * CELL_FT,
      height: heightCells * CELL_FT,
    },
    terrain: { widthCells, heightCells, elevationFt, materialIndex, materials },
    features,
  };
}

describe('stitchLocalsEastWest', () => {
  const W = 10;
  const H = 10;
  const SIZE = W * CELL_FT; // 50 ft

  it('concatenates two adjacent locales into one double-width artifact', () => {
    const a = makeLocale(0, 0, W, H, ['grass'], (cx, cy) => cx + cy * 100, () => 0);
    const b = makeLocale(SIZE, 0, W, H, ['grass'], (cx, cy) => 1000 + cx + cy * 100, () => 0);

    const s = stitchLocalsEastWest(a, b);

    expect(s.terrain.widthCells).toBe(2 * W);
    expect(s.terrain.heightCells).toBe(H);
    expect(s.bounds).toEqual({ x: 0, y: 0, width: 2 * SIZE, height: H * CELL_FT });
    // Row-major join: row r = [A row r..., B row r...] with values untouched.
    for (const cy of [0, 4, H - 1]) {
      expect(s.terrain.elevationFt[cy * 2 * W + 3]).toBe(3 + cy * 100); // from A
      expect(s.terrain.elevationFt[cy * 2 * W + W + 3]).toBe(1003 + cy * 100); // from B
    }
  });

  it('remaps B material indices into the merged materials list', () => {
    const a = makeLocale(0, 0, W, H, ['grass', 'water'], () => 0, (cx) => (cx === 0 ? 1 : 0));
    // B: index 0 = water, index 1 = rock — same names, different order than A.
    const b = makeLocale(SIZE, 0, W, H, ['water', 'rock'], () => 0, (cx) => (cx === 0 ? 0 : 1));

    const s = stitchLocalsEastWest(a, b);
    const mats = s.terrain.materials;
    // Merged list holds each material once.
    expect(new Set(mats).size).toBe(mats.length);
    const at = (cx: number, cy: number) => mats[s.terrain.materialIndex[cy * 2 * W + cx]];
    expect(at(0, 0)).toBe('water'); // A col 0
    expect(at(3, 0)).toBe('grass'); // A elsewhere
    expect(at(W, 0)).toBe('water'); // B col 0
    expect(at(W + 3, 0)).toBe('rock'); // B elsewhere
  });

  it('keeps features from both halves with collision-free ids', () => {
    const a = makeLocale(0, 0, W, H, ['grass'], () => 0, () => 0, [
      { id: 1, kind: 'tree', x: 10, y: 10 },
    ]);
    const b = makeLocale(SIZE, 0, W, H, ['grass'], () => 0, () => 0, [
      { id: 1, kind: 'boulder', x: SIZE + 10, y: 10 },
    ]);

    const s = stitchLocalsEastWest(a, b);

    expect(s.features).toHaveLength(2);
    expect(new Set(s.features.map((f) => f.id)).size).toBe(2);
    // World-feet positions ride through unchanged.
    expect(s.features.find((f) => f.kind === 'boulder')?.x).toBe(SIZE + 10);
  });

  it('throws when the locales are not exactly adjacent east-west', () => {
    const a = makeLocale(0, 0, W, H, ['grass'], () => 0, () => 0);
    const gap = makeLocale(SIZE + 25, 0, W, H, ['grass'], () => 0, () => 0);
    const offRow = makeLocale(SIZE, 25, W, H, ['grass'], () => 0, () => 0);

    expect(() => stitchLocalsEastWest(a, gap)).toThrow(/adjacent/i);
    expect(() => stitchLocalsEastWest(a, offRow)).toThrow(/adjacent/i);
  });
});
