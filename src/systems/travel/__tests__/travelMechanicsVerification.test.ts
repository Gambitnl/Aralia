/**
 * @file travelMechanicsVerification.test.ts — end-to-end proof for the four
 * maritime-remainder travel mechanics (board task agora-c8c4).
 *
 * WHY THIS FILE EXISTS: the per-unit suites already cover each piece in
 * isolation (multiModalAtlasGraph, navDrift, forcedMarch, travelReadout,
 * AtlasSvgView). What was never proven is the CHAIN a player actually walks:
 * pick a ferry destination → pay the fare → arrive on the far shore; roll a
 * failed navigation check → drift; push past the safe day → exhaustion → a
 * slower party. This file drives the real planner, the real fare rule, the real
 * reducers, and the real speed helper, so a regression anywhere along the chain
 * fails here even when every unit test still passes.
 *
 * WHAT IS PRESERVED: nothing here mutates production behavior. The fixtures are
 * the same tiny hand-built atlases the graph suite already uses, kept local so
 * this file reads on its own.
 *
 * WHAT REMAINS UNCERTAIN / DEFERRED: the party-wide 'exhaustion' condition does
 * not STACK (SET_PARTY_CONDITION is idempotent by design), so travel exhaustion
 * tops out at level 1 today. Registered in docs/projects/GLOBAL_GAPS.md.
 */
import { describe, it, expect } from 'vitest';
import { appReducer } from '../../../state/appState';
import { createMockGameState, createMockPlayerCharacter } from '../../../utils/core/factories';
import { makeCellLocationId } from '../../../utils/location/cellLocationId';
import type { FmgAtlasResult } from '../../worldforge/fmg/generateAtlas';
import { buildAtlasTravelGraph } from '../../worldforge/travel/atlasTravelGraph';
import { buildMultiModalAtlasGraph } from '../../worldforge/travel/multiModalAtlasGraph';
import { planRoutesFrom, transportSpeedMph } from '../routePlanning';
import { segmentRoute } from '../multiModalRoute';
import { ferryFare, formatMultiModalSummary } from '../travelReadout';
import { deriveNavDrift } from '../navDrift';
import { calculateForcedMarchStatus } from '../TravelCalculations';
import { resolveForcedMarch, partyExhaustionLevel, exhaustedSpeedMph } from '../forcedMarch';
import { SeededRandom } from '@/utils/random';

/**
 * Five-cell world: land 0 — port 1 — ferry lane 2 — ferry lane 3 — port 4.
 * Land travel cannot cross cells 2/3; a hired ferry can. Mirrors the fixture in
 * systems/worldforge/travel/__tests__/multiModalAtlasGraph.test.ts.
 */
function makePortedIslandAtlas(): FmgAtlasResult {
  return {
    graphWidth: 5,
    biomesData: { name: ['Marine', 'Grassland'] },
    pack: {
      cells: {
        c: [[1], [0, 2], [1, 3], [2, 4], [3]],
        p: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
        h: [30, 30, 5, 5, 30],
        biome: [1, 1, 0, 0, 1],
        haven: [0, 2, 0, 0, 3],
        harbor: [0, 1, 0, 0, 1],
      },
      burgs: [{ i: 0 }, { i: 1, cell: 1, port: 7 }, { i: 2, cell: 4, port: 7 }],
      routes: [{ group: 'searoutes', cells: [2, 3] }],
    },
  } as unknown as FmgAtlasResult;
}

const MILES_PER_UNIT = 1;

// ── 1. Ferry trips transport the party end-to-end ───────────────────────────
describe('travel mechanic 1: ferry trips transport the party end-to-end', () => {
  it('land-only travel cannot reach the far shore at all', () => {
    const atlas = makePortedIslandAtlas();
    const landField = planRoutesFrom(buildAtlasTravelGraph(atlas), 0, {
      milesPerUnit: MILES_PER_UNIT,
      speedMph: transportSpeedMph({ method: 'walking' }),
    });
    expect(landField.to(4)).toBeNull();
  });

  it('a hired ferry plans origin→far-shore with real sea legs and a fare', () => {
    const atlas = makePortedIslandAtlas();
    const field = planRoutesFrom(
      buildMultiModalAtlasGraph(atlas, { landSpeedMph: 3, sea: { kind: 'ferry', speedMph: 8 } }),
      0,
      { milesPerUnit: MILES_PER_UNIT, speedMph: 3 },
    );
    const plan = field.to(4);
    expect(plan).not.toBeNull();
    // The itinerary walks to the port, crosses BOTH lane cells, and lands on 4.
    expect(plan!.cells).toEqual([0, 1, 2, 3, 4]);

    const route = segmentRoute(plan!, (cell) => ([0, 1, 4].includes(cell) ? 'land' : 'sea'), MILES_PER_UNIT);
    expect(route.segments.map((s) => s.kind)).toEqual(['land', 'sea', 'land']);
    expect(route.seaMiles).toBeGreaterThan(0);
    expect(route.landMiles).toBeGreaterThan(0);

    // Fare = 2 gp boarding + 0.5 gp/sea-mile, rounded up. The crossing spans two
    // graph units of open water (port 1 → lane 2 → lane 3, then ashore at 4).
    expect(route.seaMiles).toBeCloseTo(2, 5);
    expect(ferryFare(route)).toBe(3);
  });

  it('committing the trip charges the fare and lands the party on the far shore', () => {
    const atlas = makePortedIslandAtlas();
    const field = planRoutesFrom(
      buildMultiModalAtlasGraph(atlas, { landSpeedMph: 3, sea: { kind: 'ferry', speedMph: 8 } }),
      0,
      { milesPerUnit: MILES_PER_UNIT, speedMph: 3 },
    );
    const route = segmentRoute(field.to(4)!, (cell) => ([0, 1, 4].includes(cell) ? 'land' : 'sea'), MILES_PER_UNIT);
    const fare = ferryFare(route);

    // The real reducers run the exact two dispatches App fires on arrival
    // (MODIFY_GOLD for the fare, MOVE_PLAYER carrying the destination cell).
    const start = createMockGameState({
      gold: 25,
      playerCell: { cellId: 0, localeCoords: { x: 5, y: 5 } },
    });
    const paid = appReducer(start, { type: 'MODIFY_GOLD', payload: { amount: -fare } });
    const arrived = appReducer(paid, {
      type: 'MOVE_PLAYER',
      payload: {
        newLocationId: makeCellLocationId(4),
        activeDynamicNpcIds: null,
        destinationCell: { cellId: 4, anchor: { cellId: 4, centerPx: [4, 0] } },
      },
    });

    expect(paid.gold).toBe(25 - fare);
    expect(arrived.playerCell).toEqual({ cellId: 4, localeCoords: null });
    expect(arrived.currentLocationId).toBe(makeCellLocationId(4));
  });

  it('an unaffordable fare is the gate MapPane checks before moving', () => {
    // MapPane rejects the trip when partyGold < fare; the rule is the same
    // comparison proven here so the readout number and the gate cannot drift.
    const route = { seaMiles: 20 };
    expect(ferryFare(route)).toBe(12);
    expect(5 < ferryFare(route)).toBe(true);
  });
});

// ── 2. Navigation drift ─────────────────────────────────────────────────────
describe('travel mechanic 2: navigation drift on an unmaintained route', () => {
  const routeCells = [10, 11, 12];
  const routePoints: Array<[number, number]> = [[0, 0], [5, 0], [10, 0]];
  const wilds = () => ({ dc: 15, cause: 'wilds' as const });
  const road = () => ({ dc: 0, cause: 'road' as const });

  it('a maintained road route never rolls (no drift)', () => {
    expect(deriveNavDrift(road, routeCells, routePoints, 0, new SeededRandom(1))).toBeUndefined();
  });

  it('an off-road route can get lost, drifting a wrong heading and burning hours', () => {
    // Scan seeds for a losing roll; the point is that drift is REACHABLE and
    // well-formed, not that any single seed fails.
    let drift: ReturnType<typeof deriveNavDrift>;
    let foundSeed = -1;
    for (let seed = 0; seed < 60 && !drift; seed++) {
      drift = deriveNavDrift(wilds, routeCells, routePoints, -5, new SeededRandom(seed));
      if (drift) foundSeed = seed;
    }
    expect(drift).toBeDefined();
    expect(drift!.lost).toBe(true);
    expect(drift!.cause).toBe('wilds');
    expect(drift!.extraSeconds).toBeGreaterThan(0);
    // The intended heading is due EAST (points run +x); a drift is a WRONG one.
    expect(drift!.driftDirection).not.toBe('E');

    // Deterministic: the same seed reproduces the same drift, which is what
    // makes a committed trip replayable from (worldSeed, destination cell).
    const again = deriveNavDrift(wilds, routeCells, routePoints, -5, new SeededRandom(foundSeed));
    expect(again).toEqual(drift);
  });

  it('a strong navigator is far less likely to drift than a poor one', () => {
    // Sampled from ONE rng stream per party rather than from fresh small seeds:
    // SeededRandom is a Lehmer generator, so its FIRST draw off a small seed is
    // nearly always the minimum (seeds 1..9 all roll a natural 1). That bias is
    // a real hazard for the production seeding in MapPane and is registered in
    // docs/projects/GLOBAL_GAPS.md; it is not what this test is measuring.
    const lostCount = (survival: number) => {
      const rng = new SeededRandom(987654321);
      let n = 0;
      for (let trip = 0; trip < 200; trip++) {
        if (deriveNavDrift(wilds, routeCells, routePoints, survival, rng)) n++;
      }
      return n;
    };
    const poor = lostCount(-5);
    const strong = lostCount(10);
    expect(poor).toBeGreaterThan(strong);
    expect(strong).toBeLessThan(60); // DC 15 with +10 fails only on a 1-4
  });
});

// ── 3. Forced-march exhaustion, and its effect on speed ─────────────────────
describe('travel mechanic 3: forced march exhausts the party and slows it down', () => {
  const conParty = (con: number) => [
    createMockPlayerCharacter({ id: 'a', name: 'Ardra', finalAbilityScores: { Constitution: con } as never }),
    createMockPlayerCharacter({ id: 'b', name: 'Brann', finalAbilityScores: { Constitution: con } as never }),
  ];

  it('a trip inside the safe day is not a forced march', () => {
    const status = calculateForcedMarchStatus(8);
    expect(status.isForcedMarch).toBe(false);
    expect(status.constitutionSaveDC).toBe(0);
  });

  it('pushing past 8 hours raises the Constitution save DC with each extra hour', () => {
    expect(calculateForcedMarchStatus(9).constitutionSaveDC).toBe(11);
    expect(calculateForcedMarchStatus(10).constitutionSaveDC).toBe(12);
    expect(calculateForcedMarchStatus(12).constitutionSaveDC).toBe(14);
  });

  it('failed saves wear the party down and set the party-wide exhaustion condition', () => {
    const party = conParty(10);
    const outcome = resolveForcedMarch(party, 12, () => 3); // 3 + 0 = 3 < 12 → both fail
    expect(outcome.anyFailed).toBe(true);
    expect(outcome.failedNames).toEqual(['Ardra', 'Brann']);

    const after = appReducer(createMockGameState({ party }), {
      type: 'SET_PARTY_CONDITION',
      payload: { condition: 'exhaustion' },
    });
    expect(after.party.every((pc) => pc.conditions?.includes('exhaustion'))).toBe(true);
    expect(partyExhaustionLevel(after.party)).toBe(1);
  });

  it('a hardy party can shrug off the same march', () => {
    const outcome = resolveForcedMarch(conParty(20), 12, () => 18); // 18 + 5 = 23
    expect(outcome.anyFailed).toBe(false);
    expect(outcome.failedNames).toEqual([]);
  });

  it('exhaustion slows overland travel, so the same route takes longer', () => {
    const walking = transportSpeedMph({ method: 'walking' });
    expect(walking).toBe(3);
    const exhausted = exhaustedSpeedMph(walking, 1);
    expect(exhausted).toBeLessThan(walking);
    expect(exhausted).toBeCloseTo(2.5, 5); // 30 ft − 5 ft = 25 ft ≈ 2.5 mph

    // The slower speed lands in real trip time through the shared planner.
    const atlas = makePortedIslandAtlas();
    const graph = buildAtlasTravelGraph(atlas);
    const rested = planRoutesFrom(graph, 0, { milesPerUnit: MILES_PER_UNIT, speedMph: walking }).to(1)!;
    const worn = planRoutesFrom(graph, 0, { milesPerUnit: MILES_PER_UNIT, speedMph: exhausted }).to(1)!;
    expect(worn.minutes).toBeGreaterThan(rested.minutes);
    expect(worn.minutes / rested.minutes).toBeCloseTo(walking / exhausted, 3);
  });

  it('a rested party is never penalized, and the penalty floors above zero', () => {
    expect(exhaustedSpeedMph(3, 0)).toBe(3);
    expect(exhaustedSpeedMph(3, 6)).toBeGreaterThan(0); // level 6 is death elsewhere; speed never goes negative
    expect(partyExhaustionLevel([createMockPlayerCharacter({ id: 'c', name: 'Cai' })])).toBe(0);
  });
});

// ── 4. Atlas readout: fares on a previewed ferry route ──────────────────────
describe('travel mechanic 4: the atlas readout names the ferry fare', () => {
  const route = {
    cells: [0, 1, 2],
    points: [[0, 0], [1, 0], [4, 0]] as Array<[number, number]>,
    segments: [],
    miles: 4,
    landMiles: 1,
    seaMiles: 3,
    minutes: 60,
    danger: 0.2,
  };

  it('appends "Fare: N gp" to the multimodal summary when a fare applies', () => {
    const summary = formatMultiModalSummary(route as never, { fareGp: ferryFare(route) });
    expect(summary).toContain('1.0 mi land');
    expect(summary).toContain('3.0 mi sea');
    expect(summary).toContain('Fare: 4 gp');
  });

  it('omits the fare clause for an owned ship or an all-land trip', () => {
    expect(formatMultiModalSummary(route as never, { fareGp: null })).not.toContain('Fare');
    expect(formatMultiModalSummary({ ...route, seaMiles: 0 } as never, { fareGp: 0 })).not.toContain('Fare');
  });
});
