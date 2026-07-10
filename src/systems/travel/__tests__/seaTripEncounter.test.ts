import { describe, it, expect } from 'vitest';
import { rollSeaEncounter, rollTravelEncounter } from '../travelEncounter';
import type { RoutePlan } from '../routePlanning';
import { rootSeedPath } from '../../worldforge/seedPath';
import { SEA_ENCOUNTER_TABLE } from '../../naval/seaEncounter';
import type { FmgAtlasResult } from '../../worldforge/fmg/generateAtlas';
import {
  SEA_DANGER_LANE,
  SEA_DANGER_COASTAL,
  SEA_DANGER_OPEN,
  seaDangerForTier,
  classifySeaCell,
  routeSeaDanger,
} from '../../worldforge/travel/multiModalAtlasGraph';

const seed = rootSeedPath(42);

/** Build a RoutePlan over the given cell ids (points/miles/minutes are synthetic). */
const route = (cells: number[], danger = 0.5): RoutePlan => ({
  cells,
  points: cells.map((c) => [c, 0] as [number, number]),
  miles: cells.length,
  minutes: cells.length * 20,
  danger,
});

/**
 * Tiny world map for tier classification:
 *   cell 0 = land, cells 1..3 = sea.
 *   cell 1 = coastal (neighbor 0 is land),
 *   cell 2 = lane (in searoutes),
 *   cell 3 = open ocean (neighbor 2 is sea).
 */
function makeSeaAtlas(): FmgAtlasResult {
  return {
    graphWidth: 4,
    biomesData: { name: ['Marine', 'Grassland'] },
    pack: {
      cells: {
        c: [[1], [0, 2], [1, 3], [2]],
        p: [[0, 0], [1, 0], [2, 0], [3, 0]],
        h: [30, 5, 5, 5],
        biome: [1, 0, 0, 0],
      },
      routes: [{ group: 'searoutes', cells: [2] }],
    },
  } as unknown as FmgAtlasResult;
}

// ── Requirement 1: sea danger tiers ─────────────────────────────────────────

describe('sea danger tiers', () => {
  it('constants obey the invariant lane < coastal < open-ocean', () => {
    expect(SEA_DANGER_LANE).toBeLessThan(SEA_DANGER_COASTAL);
    expect(SEA_DANGER_COASTAL).toBeLessThan(SEA_DANGER_OPEN);
  });

  it('seaDangerForTier weights follow the same ordering', () => {
    expect(seaDangerForTier('lane')).toBeLessThan(seaDangerForTier('coastal'));
    expect(seaDangerForTier('coastal')).toBeLessThan(seaDangerForTier('open'));
  });

  it('classifies a sea cell from atlas topology (lane / coastal / open)', () => {
    const atlas = makeSeaAtlas();
    expect(classifySeaCell(atlas, 1)).toBe('coastal'); // adjacent to land cell 0
    expect(classifySeaCell(atlas, 2)).toBe('lane'); // on a searoute
    expect(classifySeaCell(atlas, 3)).toBe('open'); // only sea neighbors
  });

  it('routeSeaDanger is the MAX sea tier over a route and 0 for all-land', () => {
    const atlas = makeSeaAtlas();
    // Route touching coastal(0.3), lane(0.12), open(0.5) → max is open.
    expect(routeSeaDanger(atlas, [0, 1, 2, 3])).toBe(SEA_DANGER_OPEN);
    // Route hugging only the lane cell → lane danger.
    expect(routeSeaDanger(atlas, [0, 2])).toBe(SEA_DANGER_LANE);
    // Pure land route → no sea danger.
    expect(routeSeaDanger(atlas, [0])).toBe(0);
  });
});

// ── Requirement 2/4: rollSeaEncounter ───────────────────────────────────────

const isSea = (c: number) => c !== 0; // cell 0 is land, everything else is sea

describe('rollSeaEncounter', () => {
  it('an all-land route (no sea cell) never rolls a sea encounter', () => {
    const r = rollSeaEncounter(route([0, 0, 0], 0.9), () => false, SEA_DANGER_OPEN, seed);
    expect(r.encounter).toBe(false);
    expect(r.chance).toBe(0);
    expect(r.outcome).toBeNull();
  });

  it('is seed-stable for the same route + danger + seed', () => {
    const cells = [0, 1, 2, 3, 1, 2, 3];
    const a = rollSeaEncounter(route(cells), isSea, SEA_DANGER_OPEN, seed);
    const b = rollSeaEncounter(route(cells), isSea, SEA_DANGER_OPEN, seed);
    expect(a).toEqual(b);
  });

  it('chance rises with sea danger and with the number of sea steps', () => {
    const shortCalm = rollSeaEncounter(route([0, 1]), isSea, SEA_DANGER_LANE, seed).chance;
    const longRough = rollSeaEncounter(
      route([0, ...Array.from({ length: 40 }, () => 1)]),
      isSea,
      SEA_DANGER_OPEN,
      seed,
    ).chance;
    expect(longRough).toBeGreaterThan(shortCalm);
    expect(longRough).toBeLessThanOrEqual(0.95);
  });

  it('when an encounter fires it draws from the SEA table and lands on a sea cell', () => {
    // A long, open-ocean crossing makes an encounter near-certain.
    const cells = [0, ...Array.from({ length: 60 }, () => 1)];
    const r = rollSeaEncounter(route(cells), isSea, SEA_DANGER_OPEN, seed);
    expect(r.encounter).toBe(true);
    expect(r.outcome).not.toBeNull();
    expect(SEA_ENCOUNTER_TABLE).toContain(r.outcome);
    // Placement is on a sea step (never the start land cell).
    expect(r.atCellIndex!).toBeGreaterThanOrEqual(1);
    expect(isSea(cells[r.atCellIndex!])).toBe(true);
  });

  it('produces both hostile and peaceful sea outcomes across seeds', () => {
    const cells = [0, ...Array.from({ length: 60 }, () => 1)];
    const kinds = new Set<boolean>();
    for (let s = 0; s < 40; s++) {
      const r = rollSeaEncounter(route(cells), isSea, SEA_DANGER_OPEN, rootSeedPath(s));
      if (r.encounter && r.outcome) kinds.add(r.outcome.hostile);
    }
    // The starter table has both hostile (pirates/beast) and peaceful (wreck/…) beats.
    expect(kinds.has(true)).toBe(true);
    expect(kinds.has(false)).toBe(true);
  });
});

// ── Requirement 4: all-land behavior preserved ──────────────────────────────

describe('land encounter roll is unaffected', () => {
  it('rollTravelEncounter still resolves an all-land route deterministically', () => {
    const a = rollTravelEncounter(route([0, 1, 2, 3, 4], 0.5), seed);
    const b = rollTravelEncounter(route([0, 1, 2, 3, 4], 0.5), seed);
    expect(a).toEqual(b);
  });
});
