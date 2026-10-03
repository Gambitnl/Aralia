// src/systems/worldforge/erosion/__tests__/atlasErosionBake.test.ts
//
// Gates for the atlas-scale erosion bake and its rock-hardness field:
//   1. Determinism — the same atlas gives bit-identical hardness and discharge.
//   2. Conservation — discharge grows downstream and never strands a basin.
//   3. Hardness reads the ATLAS, not a noise field.
import { describe, it, expect } from 'vitest';
import {
  computeRockHardness,
  erodibilityOf,
  talusScaleOf,
  REFERENCE_HARDNESS,
} from '../rockHardness';
import { bakeAtlasErosion, type ErosionAtlasInput } from '../atlasErosionBake';

/**
 * A synthetic atlas: an 11x11 square-lattice mesh with 4-neighbor adjacency.
 * The west edge is sea, the land rises east into a ridge. Deterministic by
 * construction — no RNG.
 */
function makeSyntheticAtlas(): ErosionAtlasInput & { n: number } {
  const N = 11;
  const n = N * N;
  const p: Array<[number, number]> = [];
  const h = new Uint8Array(n);
  const t = new Int8Array(n);
  const biome = new Uint8Array(n);
  const fl = new Uint16Array(n);
  const area = new Uint16Array(n);
  const b = new Uint8Array(n);
  const c: number[][] = [];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const id = j * N + i;
      p.push([i * 10, j * 10]);
      // West three columns are sea; land rises east, with a dip at i === 7 so
      // the fill has a real closed basin to solve.
      const raised = i < 3 ? 6 + i * 5 : 22 + (i - 3) * 8 - (i === 7 ? 14 : 0);
      h[id] = Math.min(99, raised);
      t[id] = i < 3 ? -1 : Math.min(13, i - 2);
      biome[id] = i < 3 ? 0 : 4;
      fl[id] = 0;
      area[id] = 100;
      b[id] = i === 0 || j === 0 || i === N - 1 || j === N - 1 ? 1 : 0;
      const nbrs: number[] = [];
      if (i > 0) nbrs.push(id - 1);
      if (i < N - 1) nbrs.push(id + 1);
      if (j > 0) nbrs.push(id - N);
      if (j < N - 1) nbrs.push(id + N);
      c.push(nbrs);
    }
  }
  return {
    n, p, h, t, biome, fl, c, area, b, g: undefined, gridPrecipitation: undefined,
  };
}

const ATLAS = makeSyntheticAtlas();

describe('rock hardness — reads the atlas, not a noise field', () => {
  it('gives the reference rock erodibility and talus scale of exactly 1', () => {
    expect(erodibilityOf(REFERENCE_HARDNESS)).toBe(1);
    expect(talusScaleOf(REFERENCE_HARDNESS)).toBe(1);
  });

  it('couples the two effects in opposite senses — the whole point of the field', () => {
    // Hard rock resists incision AND holds a steeper slope.
    expect(erodibilityOf(0.9)).toBeLessThan(1);
    expect(talusScaleOf(0.9)).toBeGreaterThan(1);
    // Soft rock does the reverse.
    expect(erodibilityOf(0.1)).toBeGreaterThan(1);
    expect(talusScaleOf(0.1)).toBeLessThan(1);
  });

  it('keeps every cell inside 0..1', () => {
    const hard = computeRockHardness(ATLAS);
    for (let i = 0; i < hard.length; i++) {
      expect(hard[i]).toBeGreaterThanOrEqual(0);
      expect(hard[i]).toBeLessThanOrEqual(1);
    }
  });

  it('makes the cratonic interior harder than the coast', () => {
    const hard = computeRockHardness(ATLAS);
    // Same row, one cell in from the shore versus deep inland.
    const row = 5 * 11;
    expect(hard[row + 9]).toBeGreaterThan(hard[row + 3]);
  });

  it('softens a cell that carries a large atlas flux', () => {
    const wet = { ...ATLAS, fl: Uint16Array.from(ATLAS.fl!, () => 400) };
    const dry = computeRockHardness(ATLAS);
    const soaked = computeRockHardness(wet);
    for (let i = 0; i < dry.length; i++) expect(soaked[i]).toBeLessThanOrEqual(dry[i]);
  });

  it('rejects an atlas whose arrays disagree rather than guessing', () => {
    expect(() =>
      computeRockHardness({ ...ATLAS, t: new Int8Array(3) }),
    ).toThrow(/arrays disagree/);
  });
});

describe('atlas erosion bake', () => {
  it('is bit-identical across two runs on the same atlas', () => {
    const a = bakeAtlasErosion(ATLAS);
    const b = bakeAtlasErosion(ATLAS);
    expect(new Uint8Array(a.discharge.buffer)).toEqual(new Uint8Array(b.discharge.buffer));
    expect(new Uint8Array(a.hardness.buffer)).toEqual(new Uint8Array(b.hardness.buffer));
  });

  it('keeps normalized discharge inside 0..1', () => {
    const { discharge } = bakeAtlasErosion(ATLAS);
    for (let i = 0; i < discharge.length; i++) {
      expect(discharge[i]).toBeGreaterThanOrEqual(0);
      expect(discharge[i]).toBeLessThanOrEqual(1);
    }
  });

  it('routes water DOWNSTREAM: total flow reaching the sea covers the land rain', () => {
    const { rawDischarge } = bakeAtlasErosion(ATLAS);
    // The lowest land column is the outlet of the whole slope. Its flow must
    // exceed the flow of a headwater cell by a wide margin, or the routing has
    // stranded water in a pit.
    const row = 5 * 11;
    expect(rawDischarge[row + 3]).toBeGreaterThan(rawDischarge[row + 9] * 3);
  });

  it('fills depressions instead of stranding the basin behind them', () => {
    // Column 7 is a dip. With no fill it would be a sink and the cells east of
    // it would drain nowhere. Every land cell must carry at least its own rain.
    const { rawDischarge } = bakeAtlasErosion(ATLAS);
    for (let i = 0; i < ATLAS.n; i++) {
      if (ATLAS.h[i] < 20) continue;
      expect(rawDischarge[i]).toBeGreaterThan(0);
    }
  });

  it('rejects a graph it cannot reach across rather than stranding a basin', () => {
    // An atlas with no sea and no border outlet has nowhere for water to go.
    const closed: ErosionAtlasInput = {
      ...ATLAS,
      h: Uint8Array.from(ATLAS.h, () => 50),
      b: Uint8Array.from(ATLAS.b!, () => 0),
    };
    expect(() => bakeAtlasErosion(closed)).toThrow(/priority-flood reached/);
  });

  it('does not report an eroded elevation — the atlas keeps that authority', () => {
    const field = bakeAtlasErosion(ATLAS) as unknown as Record<string, unknown>;
    expect(field.elevation).toBeUndefined();
    expect(Object.keys(field).sort()).toEqual(
      ['discharge', 'hardness', 'rawDischarge', 'spacingPx'],
    );
  });
});
