/**
 * @file forestKindForCell.test.ts — per-cell forest-kind lookup, escalate-only
 * biome override, and named-forest-on-route (forests campaign Task 3,
 * spec 2026-07-11-forests-design).
 *
 * Bridge handling: `getBridgeAtlas` is stubbed with synthetic per-seed atlases
 * (the `useKnownPortsSync.test.tsx` / `useVoyageArrival.test.tsx` vi.mock
 * pattern) rather than the real-atlas pattern of `local/__tests__/
 * biomeForCell.test.ts` — a real seed is never GUARANTEED to roll a haunted or
 * fey forest (6% / 4% bands), so kinds here must be authored, not rolled.
 */
import { describe, it, expect, vi } from 'vitest';
import type { ForestKind } from '../forestClusters';

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
  buildForestKindLookup,
  lookupForAtlas,
  forestKindForCell,
  namedForestOnRoute,
} from '../forestKindForCell';
import { biomeIdForCell } from '../../local/biomeForCell';

interface TestForest { i: number; name: string; kind: ForestKind; cells: number[] }

/** Minimal atlas: just what biomeIdForCell + the kind lookup read. */
const makeAtlas = (biome: number[], forests?: TestForest[]): object =>
  ({ pack: { cells: { biome }, forests } });

// ---------------------------------------------------------------------------
// Fixture worlds. FMG biome indices (wfBiomeToLegacy.ts): 4 Grassland →
// plains_prairie, 6 Temperate deciduous → forest_temperate, 8 Temperate
// rainforest → forest_ancient, 9 Taiga → forest_boreal.
//
// Seed 41: cell 0 haunted wood, 1 fey wood, 2 ordinary wood on biome 8,
// 3 grassland (no forest), 4 ancient wood on taiga, 5 anonymous copse
// (forest biome, no named forest).
// ---------------------------------------------------------------------------
const FORESTS_41: TestForest[] = [
  { i: 1, name: 'Angshire Wraithwood', kind: 'haunted', cells: [0] },
  { i: 2, name: 'Angshire Glimmerwood', kind: 'fey', cells: [1] },
  { i: 3, name: 'Angshire Weald', kind: 'ordinary', cells: [2] },
  { i: 4, name: 'Angshire Elderwood', kind: 'ancient', cells: [4] },
];
atlasBySeed.set(41, makeAtlas([6, 6, 8, 4, 9, 6], FORESTS_41));
// Seed 42: forests pass never ran (pack.forests absent).
atlasBySeed.set(42, makeAtlas([6, 4]));

describe('buildForestKindLookup (pure)', () => {
  it('maps every member cell to its forest kind, null elsewhere', () => {
    const kindOf = buildForestKindLookup({
      forests: [
        { i: 1, kind: 'haunted', cells: [3, 4] },
        { i: 2, kind: 'ordinary', cells: [7] },
      ],
    });
    expect(kindOf(3)).toBe('haunted');
    expect(kindOf(4)).toBe('haunted');
    expect(kindOf(7)).toBe('ordinary');
    expect(kindOf(5)).toBeNull();   // between the woods
    expect(kindOf(999)).toBeNull(); // far outside
  });

  it('returns null for everything when the pack carries no forests', () => {
    const kindOf = buildForestKindLookup({});
    expect(kindOf(0)).toBeNull();
  });
});

describe('lookupForAtlas (per-atlas WeakMap cache)', () => {
  it('returns the SAME function for the same atlas object', () => {
    const atlas = makeAtlas([6], [{ i: 1, name: 'W', kind: 'fey', cells: [0] }]) as
      Parameters<typeof lookupForAtlas>[0];
    expect(lookupForAtlas(atlas)).toBe(lookupForAtlas(atlas));
  });

  it('keys per atlas object — a different atlas gets its own lookup', () => {
    const a = makeAtlas([6], [{ i: 1, name: 'A', kind: 'haunted', cells: [0] }]) as
      Parameters<typeof lookupForAtlas>[0];
    const b = makeAtlas([6], [{ i: 1, name: 'B', kind: 'fey', cells: [0] }]) as
      Parameters<typeof lookupForAtlas>[0];
    expect(lookupForAtlas(a)(0)).toBe('haunted');
    expect(lookupForAtlas(b)(0)).toBe('fey');
    expect(lookupForAtlas(a)).not.toBe(lookupForAtlas(b));
  });
});

describe('forestKindForCell (worldSeed entry point, bridge-cached)', () => {
  it('resolves each cell to its named-forest kind through the bridge atlas', () => {
    expect(forestKindForCell(41, 0)).toBe('haunted');
    expect(forestKindForCell(41, 1)).toBe('fey');
    expect(forestKindForCell(41, 2)).toBe('ordinary');
    expect(forestKindForCell(41, 4)).toBe('ancient');
    expect(forestKindForCell(41, 3)).toBeNull(); // grassland
    expect(forestKindForCell(41, 5)).toBeNull(); // anonymous copse
  });

  it('returns null everywhere in a world whose pack has no forests', () => {
    expect(forestKindForCell(42, 0)).toBeNull();
  });
});

describe('biomeIdForCell escalate-only forest override', () => {
  it('haunted forest cell escalates to forest_haunted', () => {
    expect(biomeIdForCell(41, 0)).toBe('forest_haunted');
  });

  it('fey forest cell escalates to forest_fey', () => {
    expect(biomeIdForCell(41, 1)).toBe('forest_fey');
  });

  it('ordinary forest keeps the plain mapping — including index 8 → forest_ancient', () => {
    expect(biomeIdForCell(41, 2)).toBe('forest_ancient');
  });

  it('ancient-KIND forest cells keep their plain biome mapping (escalate-only)', () => {
    expect(biomeIdForCell(41, 4)).toBe('forest_boreal');
  });

  it('non-forest cells are untouched', () => {
    expect(biomeIdForCell(41, 3)).toBe('plains_prairie');
  });

  it('a forest-biome cell outside any named forest (copse) keeps the plain mapping', () => {
    expect(biomeIdForCell(41, 5)).toBe('forest_temperate');
  });

  it('a cell with no biome entry still returns undefined (honest unknown)', () => {
    expect(biomeIdForCell(41, 99)).toBeUndefined();
  });

  it('a world without pack.forests keeps every plain mapping', () => {
    expect(biomeIdForCell(42, 0)).toBe('forest_temperate');
    expect(biomeIdForCell(42, 1)).toBe('plains_prairie');
  });
});

describe('namedForestOnRoute', () => {
  const pack = {
    forests: [
      { i: 1, name: 'Smallwood', kind: 'ordinary' as const, cells: [1, 2] },
      { i: 2, name: 'Bigwood', kind: 'ordinary' as const, cells: [3, 4, 5] },
    ],
  };

  it('names the LARGEST forest sharing a cell with the route', () => {
    expect(namedForestOnRoute(pack, [2, 3])).toBe('Bigwood'); // 3 cells beats 2
  });

  it('names a smaller forest when it is the only one on the route', () => {
    expect(namedForestOnRoute(pack, [0, 1])).toBe('Smallwood');
  });

  it('breaks size ties by the LOWEST forest i (array order irrelevant)', () => {
    const tied = {
      forests: [
        { i: 5, name: 'Fivewood', kind: 'ordinary' as const, cells: [1, 2] },
        { i: 3, name: 'Threewood', kind: 'ordinary' as const, cells: [7, 8] },
      ],
    };
    expect(namedForestOnRoute(tied, [1, 7])).toBe('Threewood');
  });

  it('returns null when the route crosses no named forest', () => {
    expect(namedForestOnRoute(pack, [0, 9])).toBeNull();
    expect(namedForestOnRoute(pack, [])).toBeNull();
  });

  it('returns null when the pack has no forests', () => {
    expect(namedForestOnRoute({}, [1, 2])).toBeNull();
    expect(namedForestOnRoute({ forests: [] }, [1, 2])).toBeNull();
  });
});
