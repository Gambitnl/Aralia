/**
 * @file generateInteriorMemo.test.ts — generateInterior is a pure, deterministic
 * function called redundantly across subsystems (roster bedroom-count + the 3D
 * bake + chunk reloads). It memoizes per (seedPath, plot identity) so the same
 * interior is built once. Determinism/correctness of the output is covered by
 * generateInterior.test.ts; this guards the cache (hit + no cross-contamination).
 */
import { describe, it, expect } from 'vitest';
import { generateInterior, type InteriorPlotInput } from '../generateInterior';
import { rootSeedPath } from '../../seedPath';

const SEED_PATH = rootSeedPath(99);
const house = (over: Partial<InteriorPlotInput> = {}): InteriorPlotInput => ({
  id: 3,
  footprint: [
    [0, 0],
    [40, 0],
    [40, 30],
    [0, 30],
  ],
  role: 'house',
  storeys: 2,
  ...over,
});

describe('generateInterior memoization', () => {
  it('returns the cached instance for identical (plot, seedPath)', () => {
    const a = generateInterior(house(), SEED_PATH);
    const b = generateInterior(house(), SEED_PATH);
    expect(b).toBe(a); // same reference ⇒ generated once
  });

  it('does not collide across different seed paths or plot ids', () => {
    const a = generateInterior(house({ id: 3 }), rootSeedPath(1));
    const b = generateInterior(house({ id: 3 }), rootSeedPath(2));
    const c = generateInterior(house({ id: 4 }), rootSeedPath(1));
    expect(b).not.toBe(a);
    expect(c).not.toBe(a);
    expect(a.plotId).toBe(3);
    expect(c.plotId).toBe(4);
  });

  it('keys on the footprint so a resized plot regenerates', () => {
    const small = generateInterior(house({ id: 9, footprint: [[0, 0], [20, 0], [20, 20], [0, 20]] }), SEED_PATH);
    const large = generateInterior(house({ id: 9, footprint: [[0, 0], [80, 0], [80, 60], [0, 60]] }), SEED_PATH);
    expect(large).not.toBe(small);
    expect(large.widthFt).toBeGreaterThan(small.widthFt);
  });
});
