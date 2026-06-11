/**
 * @file fmgBase.test.ts — golden-seed regression tests for the ported FMG
 * physical-world base (Worldforge build-order item 2, slice 1).
 *
 * THE GOLDEN VALUES IN THIS FILE ARE FROZEN PERSISTENCE CONTRACTS
 * (SPEC.md §4, decision #14): seed paths address saved worlds, so a change
 * that breaks these assertions silently regenerates every player's world
 * differently. If a test here fails after a refactor, the refactor is wrong —
 * do not update the constants without an explicit owner-approved world-break
 * decision recorded in docs/projects/worldforge/DECISIONS.md.
 *
 * The goldens were computed by actually running the ported code (vitest,
 * 2026-06-11) and then hard-coded. They double as the upstream-fidelity
 * contract: the port keeps FMG's RNG draw order, so these values must also
 * match what upstream FMG (TS refactor branch at .tmp/azgaar-src) produces
 * for the same seed/options. See ../ATTRIBUTION.md.
 */
import {
  generateFmgBase,
  countFeaturesByType,
} from '../generateBase';
import { fnv1a } from '../../seedPath';

const GOLDEN_SEED = 'aralia-fmg-golden-1';
const GOLDEN_OPTIONS = { width: 320, height: 180, cellsDesired: 1000 };

describe('fmg base — determinism', () => {
  it('same seed twice produces deep-equal key outputs', () => {
    const a = generateFmgBase('test-seed-1');
    const b = generateFmgBase('test-seed-1');

    expect(Array.from(a.grid.cells.h!)).toEqual(Array.from(b.grid.cells.h!));
    expect(Array.from(a.grid.cells.t!)).toEqual(Array.from(b.grid.cells.t!));
    expect(Array.from(a.grid.cells.f!)).toEqual(Array.from(b.grid.cells.f!));
    expect(a.grid.features!.length).toBe(b.grid.features!.length);
    expect(countFeaturesByType(a.grid.features!)).toEqual(
      countFeaturesByType(b.grid.features!),
    );
    expect(a.grid.points).toEqual(b.grid.points);
  });

  it('restores Math.random after generation', () => {
    const original = Math.random;
    generateFmgBase('test-seed-1', GOLDEN_OPTIONS);
    expect(Math.random).toBe(original);
  });
});

describe('fmg base — golden snapshot (FROZEN)', () => {
  it('pins the small golden world (continents, 320x180, 1000 cells)', () => {
    const { grid } = generateFmgBase(GOLDEN_SEED, GOLDEN_OPTIONS);
    const heights = Array.from(grid.cells.h!);

    // FROZEN goldens — computed by running this code, do not update casually.
    expect(grid.points.length).toBe(1008); // number of cells
    expect(grid.cellsX).toBe(42);
    expect(grid.cellsY).toBe(24);
    expect(grid.spacing).toBe(7.59);
    expect(grid.boundary.length).toBe(68);

    expect(heights.reduce((a, b) => a + b, 0)).toBe(19447); // height sum
    expect(fnv1a(heights.join(','))).toBe(594693732); // height stream hash
    expect(heights.slice(0, 10)).toEqual([0, 0, 1, 2, 3, 6, 9, 6, 9, 10]);

    expect(countFeaturesByType(grid.features!)).toEqual({
      ocean: 1,
      island: 4,
    });
    expect(grid.features!.length).toBe(6); // index 0 placeholder + 5 features

    expect(heights.filter((h) => h >= 20).length).toBe(355); // land cells
    expect(Array.from(grid.cells.t!.slice(0, 10))).toEqual([
      -6, -6, -5, -5, -5, -4, -3, -4, -4, -3,
    ]);
  });

  it('pins a second template (volcano) on the same seed', () => {
    const { grid } = generateFmgBase(GOLDEN_SEED, {
      ...GOLDEN_OPTIONS,
      template: 'volcano',
    });
    const heights = Array.from(grid.cells.h!);

    // FROZEN goldens — computed by running this code, do not update casually.
    expect(heights.reduce((a, b) => a + b, 0)).toBe(15816);
    expect(fnv1a(heights.join(','))).toBe(3520542593);
    expect(countFeaturesByType(grid.features!)).toEqual({
      ocean: 2,
      island: 1,
    });
    expect(heights.filter((h) => h >= 20).length).toBe(311);
  });

  it('pins the default-options world (continents, 960x540, 10000 cells)', () => {
    const { grid } = generateFmgBase('test-seed-1');
    const heights = Array.from(grid.cells.h!);

    // FROZEN goldens — computed by running this code, do not update casually.
    expect(grid.points.length).toBe(9975);
    expect(grid.cellsX).toBe(133);
    expect(grid.cellsY).toBe(75);
    expect(heights.reduce((a, b) => a + b, 0)).toBe(173345);
    expect(fnv1a(heights.join(','))).toBe(2640745582);
    expect(countFeaturesByType(grid.features!)).toEqual({
      ocean: 7,
      island: 14,
      lake: 6,
    });
    expect(heights.filter((h) => h >= 20).length).toBe(3751);
  });
});

describe('fmg base — sanity invariants', () => {
  it('heights stay within FMG convention [0, 100] and the world has both ocean and land', () => {
    const { grid } = generateFmgBase('test-seed-1'); // standard template (continents)
    const heights = Array.from(grid.cells.h!);

    expect(heights.length).toBe(grid.points.length);
    expect(heights.every((h) => h >= 0 && h <= 100)).toBe(true);

    const landCells = heights.filter((h) => h >= 20).length;
    const waterCells = heights.filter((h) => h < 20).length;
    expect(landCells).toBeGreaterThan(0); // land exists
    expect(waterCells).toBeGreaterThan(0); // water exists

    const counts = countFeaturesByType(grid.features!);
    expect(counts.ocean ?? 0).toBeGreaterThan(0); // ocean cells exist
    expect(counts.island ?? 0).toBeGreaterThan(0);

    // every cell got a feature id (ids start at 1; 0 means unmarked)
    expect(Array.from(grid.cells.f!).every((f) => f >= 1)).toBe(true);
  });

  it('rejects unknown templates instead of silently falling back', () => {
    expect(() =>
      generateFmgBase('test-seed-1', { template: 'not-a-template' }),
    ).toThrow(/unknown/i);
  });
});
