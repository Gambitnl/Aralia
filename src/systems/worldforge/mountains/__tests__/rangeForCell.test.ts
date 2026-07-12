/**
 * @file rangeForCell.test.ts — cached cell→range lookup, per-cell elevation
 * class, and the escalate-only elevation biome override (mountains campaign
 * Task 5, spec 2026-07-11-mountains-design §3).
 *
 * `biomeIdForCell` elevation coverage lives HERE, not under local/__tests__
 * (forests Task 3 precedent): local's own biomeForCell.test.ts is the
 * real-atlas byte-identity golden, and a real seed never GUARANTEES a peak,
 * an enclosed vale pocket, or a forest-on-highland collision — heights,
 * ranges, and forest kinds here must be authored, not rolled.
 *
 * Bridge handling: `getBridgeAtlas` is stubbed with synthetic per-seed
 * atlases (the forestKindForCell.test.ts vi.mock pattern).
 */
import { describe, it, expect, vi } from 'vitest';
import type { ForestKind } from '../../forests/forestClusters';

/** Synthetic per-seed atlas registry the mock factory reads (vi.hoisted so it
 * exists before the hoisted vi.mock runs). */
const atlasBySeed = vi.hoisted(() => new Map<number, object>());

vi.mock('../../bridge/legacySubmapBridge', () => ({
  getBridgeAtlas: (worldSeed: number): object => {
    const atlas = atlasBySeed.get(worldSeed);
    if (!atlas) throw new Error(`test stub: no synthetic atlas for seed ${worldSeed}`);
    return atlas;
  },
}));

import {
  buildRangeLookup,
  lookupRangesForAtlas,
  elevationClassForCell,
  passNameOnRoute,
} from '../rangeForCell';
import { biomeIdForCell } from '../../local/biomeForCell';

interface TestForest { i: number; name: string; kind: ForestKind; cells: number[] }

type RangeAtlas = Parameters<typeof elevationClassForCell>[0];

/** Minimal atlas: just what biomeIdForCell + the range/class lookups read. */
const makeAtlas = (opts: {
  biome?: number[];
  h?: number[];
  c?: number[][];
  ranges?: Array<{ i: number; cells: number[] }>;
  peaks?: Array<{ cellId: number }>;
  forests?: TestForest[];
}): RangeAtlas =>
  ({
    pack: {
      cells: { biome: opts.biome, h: opts.h, c: opts.c },
      ranges: opts.ranges,
      peaks: opts.peaks,
      forests: opts.forests,
    },
  }) as RangeAtlas;

// ---------------------------------------------------------------------------
// Fixture world, seed 51. FMG biome indices (wfBiomeToLegacy.ts): 4 Grassland
// → plains_prairie, 6 Temperate deciduous → forest_temperate, 8 Temperate
// rainforest → forest_ancient, 11 Glacier → mountain_glacier.
//
// cell  h   biome  role
//  0    80   4     peak of range 1                  → crag
//  1    75   4     range 1, not a peak              → alpine
//  2    60   4     range 1 shoulder                 → plateau
//  3    60   4     anonymous hills (NO range)       → null (plain mapping)
//  4    40   4     pocket ringed by range cells     → vale
//  5    40   4     pocket with one non-range side   → null (counterexample)
//  6    30   4     open lowland, no neighbours      → null (byte-identity)
//  7    80  11     GLACIER peak inside range 1      → null (mountain_glacier)
//  8    20   8     lowland temperate rainforest     → null (forest_ancient pin)
//  9    75   6     HAUNTED named forest             → forest wins over alpine
// 10    75   6     ORDINARY named forest            → alpine wins over plain
// 11    70   4     exact PEAK_MIN_H boundary        → alpine (range-free)
// 12    50   4     exact RANGE_MIN_H boundary, rng1 → plateau
// 13    69   4     top of the plateau band, rng1    → plateau
// 14    75   6     FEY named forest                 → forest wins over alpine
// 15    15   0     TARN (water) ringed by range 1   → null (water never escalates)
// ---------------------------------------------------------------------------
const BIOME_51 = [4, 4, 4, 4, 4, 4, 4, 11, 8, 6, 6, 4, 4, 4, 6, 0];
const H_51 = [80, 75, 60, 60, 40, 40, 30, 80, 20, 75, 75, 70, 50, 69, 75, 15];
const C_51: number[][] = [
  [], [], [], [], [0, 1, 2], [2, 6], [], [], [], [], [], [], [], [], [], [0, 1, 2],
];
const RANGES_51 = [{ i: 1, cells: [0, 1, 2, 7, 12, 13] }];
const PEAKS_51 = [{ cellId: 0 }, { cellId: 7 }];
const FORESTS_51: TestForest[] = [
  { i: 1, name: 'Angshire Wraithwood', kind: 'haunted', cells: [9] },
  { i: 2, name: 'Angshire Weald', kind: 'ordinary', cells: [10] },
  { i: 3, name: 'Angshire Glimmerwood', kind: 'fey', cells: [14] },
];
const atlas51 = (): RangeAtlas =>
  makeAtlas({
    biome: BIOME_51, h: H_51, c: C_51,
    ranges: RANGES_51, peaks: PEAKS_51, forests: FORESTS_51,
  });

atlasBySeed.set(51, atlas51());
// Seed 52: heights exist but the mountains pass never ran (no ranges/peaks) —
// the raw-height rules (crag needs a peak, plateau/vale need ranges) shrink
// to alpine-only.
atlasBySeed.set(52, makeAtlas({ biome: [4, 4], h: [75, 60] }));
// Seed 53: a forests-suite-shaped atlas (no h, no c, no ranges) — elevation
// can never fire, so the forests tests stay green by construction.
atlasBySeed.set(53, makeAtlas({ biome: [6] }));

describe('buildRangeLookup (pure)', () => {
  const lookup = buildRangeLookup({
    ranges: [
      { i: 1, cells: [3, 4] },
      { i: 2, cells: [7] },
    ],
    peaks: [{ cellId: 4 }],
  });

  it('rangeIdOf maps every member cell to its range id, null elsewhere', () => {
    expect(lookup.rangeIdOf(3)).toBe(1);
    expect(lookup.rangeIdOf(4)).toBe(1);
    expect(lookup.rangeIdOf(7)).toBe(2);
    expect(lookup.rangeIdOf(5)).toBeNull(); // between the ranges
    expect(lookup.rangeIdOf(999)).toBeNull(); // far outside
  });

  it('isPeakCell answers true exactly on peak cells', () => {
    expect(lookup.isPeakCell(4)).toBe(true);
    expect(lookup.isPeakCell(3)).toBe(false);
    expect(lookup.isPeakCell(999)).toBe(false);
  });

  it('answers null/false for everything when the pack carries no ranges', () => {
    const empty = buildRangeLookup({});
    expect(empty.rangeIdOf(0)).toBeNull();
    expect(empty.isPeakCell(0)).toBe(false);
  });
});

// ── passNameOnRoute (mountains Task 4, read side of pack.passes) ────────────
// The travel readout asks "which named pass does this route crest?" — the
// FIRST pass cell the route crosses, in ROUTE order, wins (a trip announces
// the pass it reaches first, not the lowest-id one).
describe('passNameOnRoute (pure)', () => {
  const passes = [
    { i: 1, rangeI: 1, cellId: 3, name: 'Astel Pass', routeIds: [1] },
    { i: 2, rangeI: 2, cellId: 9, name: 'Norvik Gap', routeIds: [2] },
  ];

  it('answers the FIRST pass cell the route crosses, in route order', () => {
    // Cell 9 comes before cell 3 on this route, so its pass wins despite the
    // higher pass id.
    expect(passNameOnRoute({ passes }, [5, 9, 3])).toBe('Norvik Gap');
    expect(passNameOnRoute({ passes }, [3, 9])).toBe('Astel Pass');
  });

  it('answers null when the route crosses no pass cell (or is empty)', () => {
    expect(passNameOnRoute({ passes }, [0, 1, 2])).toBeNull();
    expect(passNameOnRoute({ passes }, [])).toBeNull();
  });

  it('answers null when the pack carries no passes (pass not run, or none found)', () => {
    expect(passNameOnRoute({}, [3])).toBeNull();
    expect(passNameOnRoute({ passes: [] }, [3])).toBeNull();
  });
});

describe('lookupRangesForAtlas (per-atlas WeakMap cache)', () => {
  it('returns the SAME lookup for the same atlas object', () => {
    const atlas = atlas51();
    expect(lookupRangesForAtlas(atlas)).toBe(lookupRangesForAtlas(atlas));
  });

  it('keys per atlas object — a different atlas gets its own lookup', () => {
    const a = makeAtlas({ h: [60], ranges: [{ i: 1, cells: [0] }] });
    const b = makeAtlas({ h: [60], ranges: [{ i: 2, cells: [0] }] });
    expect(lookupRangesForAtlas(a).rangeIdOf(0)).toBe(1);
    expect(lookupRangesForAtlas(b).rangeIdOf(0)).toBe(2);
    expect(lookupRangesForAtlas(a)).not.toBe(lookupRangesForAtlas(b));
  });

  it('holds ONE entry per atlas: the class map shares the first build', () => {
    const atlas = makeAtlas({ biome: [4], h: [60], ranges: [{ i: 1, cells: [0] }] });
    expect(lookupRangesForAtlas(atlas).rangeIdOf(0)).toBe(1);
    // Mutating the pack after the first read changes nothing — the class read
    // below must come from the SAME cached entry, not a fresh build.
    (atlas as unknown as { pack: { ranges: unknown[] } }).pack.ranges.length = 0;
    expect(elevationClassForCell(atlas, 0)).toBe('plateau');
  });
});

describe('elevationClassForCell (rules)', () => {
  const atlas = atlas51();

  it('peak cells classify crag — crag beats alpine on the same height', () => {
    expect(elevationClassForCell(atlas, 0)).toBe('crag');
    expect(elevationClassForCell(atlas, 1)).toBe('alpine'); // same range, not a peak
  });

  it('h >= PEAK_MIN_H (70) classifies alpine, with or without a range', () => {
    expect(elevationClassForCell(atlas, 1)).toBe('alpine');
    expect(elevationClassForCell(atlas, 11)).toBe('alpine'); // exact boundary, no range
  });

  it('the 50 <= h < 70 band classifies plateau ONLY inside a named range', () => {
    expect(elevationClassForCell(atlas, 2)).toBe('plateau');
    expect(elevationClassForCell(atlas, 12)).toBe('plateau'); // exact lower boundary
    expect(elevationClassForCell(atlas, 13)).toBe('plateau'); // top of the band
    expect(elevationClassForCell(atlas, 3)).toBeNull(); // anonymous hills, no range
  });

  it('a low pocket ringed ENTIRELY by range cells classifies vale', () => {
    expect(elevationClassForCell(atlas, 4)).toBe('vale');
  });

  it('a low pocket with even one non-range neighbour is NOT a vale', () => {
    expect(elevationClassForCell(atlas, 5)).toBeNull();
  });

  it('a low cell with no neighbours is NOT a vale (no vacuous enclosure)', () => {
    expect(elevationClassForCell(atlas, 6)).toBeNull();
  });

  it('a TARN (water, h < 20) ringed by range cells never escalates', () => {
    expect(elevationClassForCell(atlas, 15)).toBeNull();
    // And through biomeForCell it keeps the plain Marine (index 0) mapping.
    expect(biomeIdForCell(51, 15)).toBe('coastal_reef');
  });

  it('Glacier (biome index 11) is NEVER escalated — even as a range peak', () => {
    expect(elevationClassForCell(atlas, 7)).toBeNull();
  });

  it('lowland cells classify null', () => {
    expect(elevationClassForCell(atlas, 8)).toBeNull();
  });

  it('a pack without ranges/peaks still classifies alpine from raw heights', () => {
    const bare = makeAtlas({ biome: [4, 4], h: [75, 60] });
    expect(elevationClassForCell(bare, 0)).toBe('alpine');
    expect(elevationClassForCell(bare, 1)).toBeNull(); // plateau needs a range
  });

  it('a pack without heights classifies null everywhere (forests-suite shape)', () => {
    const bare = makeAtlas({ biome: [6] });
    expect(elevationClassForCell(bare, 0)).toBeNull();
  });

  it('is deterministic: two identical atlas objects classify identically', () => {
    const a = atlas51();
    const b = atlas51();
    for (let cell = 0; cell < H_51.length; cell++) {
      expect(elevationClassForCell(a, cell)).toBe(elevationClassForCell(b, cell));
    }
    // And repeated reads on one atlas are stable (memoized class map).
    expect(elevationClassForCell(a, 4)).toBe('vale');
    expect(elevationClassForCell(a, 4)).toBe('vale');
  });
});

describe('biomeIdForCell elevation escalation (order: forest > elevation > plain)', () => {
  it('reaches all four revived ids on the crafted world', () => {
    expect(biomeIdForCell(51, 0)).toBe('mountain_crag');
    expect(biomeIdForCell(51, 1)).toBe('mountain_alpine');
    expect(biomeIdForCell(51, 2)).toBe('highland_plateau');
    expect(biomeIdForCell(51, 4)).toBe('highland_vale');
  });

  it('haunted forest at h 75 stays forest_haunted — forests beat elevation', () => {
    expect(biomeIdForCell(51, 9)).toBe('forest_haunted');
  });

  it('fey forest at h 75 stays forest_fey — forests beat elevation', () => {
    expect(biomeIdForCell(51, 14)).toBe('forest_fey');
  });

  it('ordinary forest at h 75 escalates to mountain_alpine', () => {
    expect(biomeIdForCell(51, 10)).toBe('mountain_alpine');
  });

  it('byte-identity: class-null cells keep exactly the plain mapping', () => {
    expect(biomeIdForCell(51, 3)).toBe('plains_prairie'); // mid-h, no range
    expect(biomeIdForCell(51, 5)).toBe('plains_prairie'); // unenclosed pocket
    expect(biomeIdForCell(51, 6)).toBe('plains_prairie'); // open lowland
  });

  it('byte-identity pin: biome index 8 still maps to forest_ancient', () => {
    expect(biomeIdForCell(51, 8)).toBe('forest_ancient');
  });

  it('byte-identity pin: Glacier index 11 still maps to mountain_glacier', () => {
    expect(biomeIdForCell(51, 7)).toBe('mountain_glacier');
  });

  it('a cell with no biome entry still returns undefined (honest unknown)', () => {
    expect(biomeIdForCell(51, 99)).toBeUndefined();
  });

  it('a world the mountains pass never touched escalates only by raw height', () => {
    expect(biomeIdForCell(52, 0)).toBe('mountain_alpine');
    expect(biomeIdForCell(52, 1)).toBe('plains_prairie');
  });

  it('a world with no height data keeps every plain mapping', () => {
    expect(biomeIdForCell(53, 0)).toBe('forest_temperate');
  });
});
