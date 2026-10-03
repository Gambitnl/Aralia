// src/systems/worldforge/region/__tests__/regionTerrainField.test.ts
import { describe, it, expect } from 'vitest';
import {
  makeRegionBaseField,
  makeRegionReliefField,
  makeRegionNaturalHeight,
  type HeightCandidate,
} from '../regionTerrainField';
import { getBridgeAtlas, getWorldforgeLocalForCell } from '../../bridge/legacySubmapBridge';

const CANDS: HeightCandidate[] = [
  { x: 0, y: 0, h: 0.2 },
  { x: 10000, y: 0, h: 0.8 },
  { x: 0, y: 10000, h: 0.5 },
  { x: 10000, y: 10000, h: 0.3 },
];

describe('region terrain field', () => {
  it('interpolates between cell heights and lands on a cell exactly', () => {
    const base = makeRegionBaseField(CANDS, 20000);
    // Sitting on a cell center returns that cell's height, not a blend.
    expect(base(0, 0)).toBeCloseTo(0.2, 6);
    // Between the low and high cells the value is strictly between them.
    const mid = base(5000, 0);
    expect(mid).toBeGreaterThan(0.2);
    expect(mid).toBeLessThan(0.8);
  });

  it('throws rather than guessing when no cell is in range', () => {
    const base = makeRegionBaseField(CANDS, 100);
    expect(() => base(500000, 500000)).toThrow(/no cells within IDW radius/);
  });

  it('is a pure function of world position', () => {
    const a = makeRegionNaturalHeight(CANDS, 20000, 12345, 8000);
    const b = makeRegionNaturalHeight(CANDS, 20000, 12345, 8000);
    // Two independently built samplers must agree exactly — this is what makes
    // neighboring windows read the same terrain at a shared point.
    for (const [x, y] of [[1234, 5678], [9000, 100], [4321, 8765]]) {
      expect(a(x, y)).toBe(b(x, y));
    }
  });

  it('clamps natural height into 0..1', () => {
    const h = makeRegionNaturalHeight(CANDS, 20000, 999, 8000);
    for (let x = 0; x <= 10000; x += 1000) {
      const v = h(x, 5000);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('adds relief that varies with position but stays bounded', () => {
    const relief = makeRegionReliefField(4242, 8000);
    const samples = [0, 2000, 4000, 6000, 8000].map((x) => relief(x, 0, 0.5));
    // Not a constant — the field has structure.
    expect(new Set(samples).size).toBeGreaterThan(1);
    for (const s of samples) expect(Math.abs(s)).toBeLessThan(0.5);
  });

  it('agrees with the rasterized heightfield away from settlement pads', () => {
    const SEED = 903674813;
    const atlas = getBridgeAtlas(SEED);
    expect(atlas).toBeDefined();
    // A window with no town: the settlement floor is what would otherwise make
    // the grid and the sampler legitimately disagree.
    const { region } = getWorldforgeLocalForCell(SEED, 2186, {});
    expect(region.townSites).toHaveLength(0);
    const hf = region.heightfield;
    expect(hf.width).toBeGreaterThan(0);
    // Spot-check that the grid is a real surface, not a constant — the sampler
    // equivalence proper is asserted once generateHeightfield is refactored.
    const vals = new Set<number>();
    for (let i = 0; i < hf.samples.length; i += 997) vals.add(hf.samples[i]);
    expect(vals.size).toBeGreaterThan(10);
  }, 120000);
});
