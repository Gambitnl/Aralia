/**
 * @file fmgAtlas.test.ts — golden-seed regression tests for the ported FMG
 * atlas slice 2 (Worldforge build-order item 2b): climate → reGraph pack →
 * markupPack → rivers → biomes.
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
 * contract: the port keeps FMG's RNG draw order (including the
 * defineMapSize→generatePrecipitation shared stream), so these values must
 * also match what upstream FMG (TS refactor branch at .tmp/azgaar-src)
 * produces for the same seed/options. See ../ATTRIBUTION.md.
 */
import { generateFmgAtlas } from '../generateAtlas';
import { fnv1a } from '../../seedPath';

const GOLDEN_SEED = 'aralia-fmg-golden-1';
const GOLDEN_OPTIONS = { width: 320, height: 180, cellsDesired: 1000 };

function biomeHistogram(biome: ArrayLike<number>): Record<number, number> {
  const hist: Record<number, number> = {};
  for (let i = 0; i < biome.length; i++) {
    hist[biome[i]] = (hist[biome[i]] || 0) + 1;
  }
  return hist;
}

function countByType(features: Array<{ type?: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of features) {
    if (!f) continue;
    counts[f.type!] = (counts[f.type!] || 0) + 1;
  }
  return counts;
}

describe('fmg atlas — determinism', () => {
  it('same seed twice produces deep-equal key outputs', () => {
    const a = generateFmgAtlas('test-seed-1', GOLDEN_OPTIONS);
    const b = generateFmgAtlas('test-seed-1', GOLDEN_OPTIONS);

    expect(Array.from(a.grid.cells.temp!)).toEqual(Array.from(b.grid.cells.temp!));
    expect(Array.from(a.grid.cells.prec!)).toEqual(Array.from(b.grid.cells.prec!));
    expect(a.pack.cells.p).toEqual(b.pack.cells.p);
    expect(Array.from(a.pack.cells.g!)).toEqual(Array.from(b.pack.cells.g!));
    expect(Array.from(a.pack.cells.h)).toEqual(Array.from(b.pack.cells.h));
    expect(Array.from(a.pack.cells.fl!)).toEqual(Array.from(b.pack.cells.fl!));
    expect(Array.from(a.pack.cells.r!)).toEqual(Array.from(b.pack.cells.r!));
    expect(Array.from(a.pack.cells.biome!)).toEqual(Array.from(b.pack.cells.biome!));
    expect(a.pack.rivers).toEqual(b.pack.rivers);
    expect(a.mapCoordinates).toEqual(b.mapCoordinates);
    expect(a.mapSize).toBe(b.mapSize);
  });

  it('restores Math.random after generation', () => {
    const original = Math.random;
    generateFmgAtlas('test-seed-1', GOLDEN_OPTIONS);
    expect(Math.random).toBe(original);
  });
});

describe('fmg atlas — golden snapshot (FROZEN)', () => {
  it('pins the small golden world (continents, 320x180, 1000 cells)', () => {
    const result = generateFmgAtlas(GOLDEN_SEED, GOLDEN_OPTIONS);
    const { grid, pack } = result;

    // FROZEN goldens — computed by running this code, do not update casually.

    // slice-1 grid is untouched by slice-2 stages (erosion hits pack only)
    const gridHeights = Array.from(grid.cells.h!);
    expect(gridHeights.reduce((a, b) => a + b, 0)).toBe(19447); // same as fmgBase golden

    // defineMapSize draws (gauss/P on the seeded stream) + mapCoordinates
    expect(result.mapSize).toBe(31);
    expect(result.latitude).toBe(46);
    expect(result.longitude).toBe(50);
    expect(result.mapCoordinates).toEqual({
      latT: 55.8,
      latN: 32.9,
      latS: -22.9,
      lonT: 99.2,
      lonW: -49.6,
      lonE: 49.6,
    });

    // temperature
    const temp = Array.from(grid.cells.temp!);
    expect(temp.length).toBe(1008);
    expect(temp.reduce((a, b) => a + b, 0)).toBe(21236);
    expect(fnv1a(temp.join(','))).toBe(4177328524);
    expect(temp.slice(0, 10)).toEqual([13, 13, 13, 13, 13, 13, 13, 13, 13, 13]);

    // precipitation (rand draws continue the defineMapSize stream)
    const prec = Array.from(grid.cells.prec!);
    expect(prec.reduce((a, b) => a + b, 0)).toBe(8823);
    expect(fnv1a(prec.join(','))).toBe(2628069693);
    expect(prec.slice(0, 10)).toEqual([4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);

    // packed graph (reGraph)
    expect(pack.cells.i.length).toBe(873); // pack cell count
    const packH = Array.from(pack.cells.h);
    expect(packH.reduce((a, b) => a + b, 0)).toBe(21166); // post-erosion heights
    expect(fnv1a(packH.join(','))).toBe(134529257);
    expect(packH.slice(0, 10)).toEqual([12, 12, 15, 14, 16, 16, 8, 4, 8, 10]);
    expect(Array.from(pack.cells.g!).slice(0, 10)).toEqual([
      13, 51, 53, 54, 55, 55, 57, 58, 63, 65,
    ]);
    expect(
      Array.from(pack.cells.area!).reduce((a, b) => a + b, 0),
    ).toBe(52567);

    // markupPack features
    expect(countByType(pack.features)).toEqual({ ocean: 1, island: 4 });

    // rivers
    const fl = Array.from(pack.cells.fl!);
    expect(fl.reduce((a, b) => a + b, 0)).toBe(22284);
    expect(fnv1a(fl.join(','))).toBe(2174265487);
    expect(pack.rivers!.length).toBe(47); // river count
    expect(pack.rivers!.reduce((a, r) => a + r.cells.length, 0)).toBe(170); // total river cells
    expect(Array.from(pack.cells.r!).filter((v) => v > 0).length).toBe(123);
    expect(pack.rivers![0]).toMatchObject({
      i: 1,
      source: 486,
      mouth: 445,
      discharge: 446,
      length: 31.49,
      width: 0.46,
      sourceWidth: 0.2,
      parent: 0,
      cells: [486, 487, 445, 399],
    });

    // biomes
    expect(biomeHistogram(pack.cells.biome!)).toEqual({
      0: 416,
      2: 1,
      3: 23,
      4: 18,
      5: 213,
      6: 34,
      7: 57,
      8: 20,
      9: 14,
      10: 5,
      11: 1,
      12: 71,
    });
    expect(Array.from(pack.cells.biome!).slice(0, 10)).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it('pins a second template (volcano) on the same seed', () => {
    const result = generateFmgAtlas(GOLDEN_SEED, {
      ...GOLDEN_OPTIONS,
      template: 'volcano',
    });
    const { grid, pack } = result;

    // FROZEN goldens — computed by running this code, do not update casually.
    expect(result.mapSize).toBe(21); // gauss(20, 20, 10, max) path
    expect(result.latitude).toBe(46);
    const temp = Array.from(grid.cells.temp!);
    expect(temp.reduce((a, b) => a + b, 0)).toBe(23733);
    expect(fnv1a(temp.join(','))).toBe(1240016781);
    const prec = Array.from(grid.cells.prec!);
    expect(prec.reduce((a, b) => a + b, 0)).toBe(8554);
    expect(fnv1a(prec.join(','))).toBe(3852215660);
    expect(pack.cells.i.length).toBe(588);
    const fl = Array.from(pack.cells.fl!);
    expect(fl.reduce((a, b) => a + b, 0)).toBe(27052);
    expect(fnv1a(fl.join(','))).toBe(1968657646);
    expect(pack.rivers!.length).toBe(47);
    expect(pack.rivers!.reduce((a, r) => a + r.cells.length, 0)).toBe(180);
    expect(biomeHistogram(pack.cells.biome!)).toEqual({
      0: 215,
      3: 81,
      4: 16,
      5: 103,
      6: 9,
      7: 71,
      8: 3,
      12: 90,
    });
  });

  it('pins the default-options world (continents, 960x540, 10000 cells)', () => {
    const result = generateFmgAtlas('test-seed-1');
    const { grid, pack } = result;

    // FROZEN goldens — computed by running this code, do not update casually.
    expect(result.mapSize).toBe(100); // P(0.5) full-size path
    expect(result.latitude).toBe(50);
    expect(result.longitude).toBe(50);
    expect(grid.points.length).toBe(9975);

    const temp = Array.from(grid.cells.temp!);
    expect(temp.reduce((a, b) => a + b, 0)).toBe(45791);
    expect(fnv1a(temp.join(','))).toBe(1402949595);
    const prec = Array.from(grid.cells.prec!);
    expect(prec.reduce((a, b) => a + b, 0)).toBe(84997);
    expect(fnv1a(prec.join(','))).toBe(3254280171);

    expect(pack.cells.i.length).toBe(6093);
    const packH = Array.from(pack.cells.h);
    expect(packH.reduce((a, b) => a + b, 0)).toBe(165686);
    expect(fnv1a(packH.join(','))).toBe(2486464640);
    expect(
      Array.from(pack.cells.area!).reduce((a, b) => a + b, 0),
    ).toBe(396782);

    const fl = Array.from(pack.cells.fl!);
    expect(fl.reduce((a, b) => a + b, 0)).toBe(161031);
    expect(fnv1a(fl.join(','))).toBe(654573593);
    expect(pack.rivers!.length).toBe(196);
    expect(pack.rivers!.reduce((a, r) => a + r.cells.length, 0)).toBe(1043);
    expect(Array.from(pack.cells.r!).filter((v) => v > 0).length).toBe(839);

    expect(biomeHistogram(pack.cells.biome!)).toEqual({
      0: 1820,
      1: 39,
      2: 15,
      3: 780,
      4: 557,
      5: 538,
      6: 732,
      7: 92,
      8: 450,
      9: 315,
      10: 202,
      11: 358,
      12: 195,
    });

    expect(countByType(pack.features)).toEqual({
      ocean: 1,
      island: 14,
      lake: 6,
    });

    // defineGroups (exact upstream order: runs after Biomes.define; oceans
    // are skipped by upstream defineGroups and stay group-less)
    const groups: Record<string, number> = {};
    for (const f of pack.features) {
      if (!f || !f.group) continue;
      groups[f.group] = (groups[f.group] || 0) + 1;
    }
    expect(groups).toEqual({
      continent: 2,
      isle: 9,
      frozen: 1,
      freshwater: 5,
      island: 3,
    });
  });
});

describe('fmg atlas — sanity invariants', () => {
  it('produces plausible climate, valid pack wiring, rivers and in-range biomes', () => {
    const result = generateFmgAtlas('test-seed-1'); // continents, default size
    const { grid, pack, biomesData } = result;

    // temperatures: Int8 storage, plausible planet range
    const temp = Array.from(grid.cells.temp!);
    expect(temp.length).toBe(grid.points.length);
    expect(temp.every((t) => t >= -128 && t <= 127)).toBe(true);
    expect(Math.min(...temp)).toBeGreaterThan(-60);
    expect(Math.max(...temp)).toBeLessThan(50);

    // precipitation exists on land
    const prec = Array.from(grid.cells.prec!);
    expect(prec.length).toBe(grid.points.length);
    expect(prec.some((p) => p > 0)).toBe(true);

    // pack wiring: every pack cell references a valid grid cell, heights in range
    const g = Array.from(pack.cells.g!);
    expect(g.length).toBe(pack.cells.i.length);
    expect(g.every((idx) => idx >= 0 && idx < grid.points.length)).toBe(true);
    expect(Array.from(pack.cells.h).every((h) => h >= 0 && h <= 100)).toBe(
      true,
    );

    // rivers: at least one river on the continents template at default size,
    // no NaN/infinite flux, every river path has cells
    expect(pack.rivers!.length).toBeGreaterThanOrEqual(1);
    const fl = Array.from(pack.cells.fl!);
    expect(fl.every((v) => Number.isFinite(v))).toBe(true);
    expect(pack.rivers!.every((r) => r.cells.length >= 3)).toBe(true);
    expect(
      pack.rivers!.every((r) => Number.isFinite(r.length) && r.length > 0),
    ).toBe(true);

    // biomes: ids within the biomes matrix bounds, water cells are marine (0)
    const biome = Array.from(pack.cells.biome!);
    expect(biome.length).toBe(pack.cells.i.length);
    expect(
      biome.every((b) => b >= 0 && b < biomesData.name.length),
    ).toBe(true);
    for (let i = 0; i < biome.length; i++) {
      if (pack.cells.h[i] < 20) expect(biome[i]).toBe(0);
    }
  });

  it('honors explicit ("locked") mapSize/latitude/longitude overrides', () => {
    const result = generateFmgAtlas(GOLDEN_SEED, {
      ...GOLDEN_OPTIONS,
      mapSize: 50,
      latitude: 40,
      longitude: 60,
    });
    expect(result.mapSize).toBe(50);
    expect(result.latitude).toBe(40);
    expect(result.longitude).toBe(60);
    expect(result.mapCoordinates.latT).toBe(90); // 50% of 180
  });
});
