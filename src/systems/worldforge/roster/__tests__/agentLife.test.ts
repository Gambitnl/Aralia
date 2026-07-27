/**
 * These tests protect the deterministic multi-day seam between the canonical
 * town history and the roster behaviour simulation.
 *
 * Hand-built villagers make aging, births, deaths, and genealogy observable in
 * a small population. The suite proves that direct and chunked replay agree,
 * event ids and ordering stay stable, dead people remain in family history but
 * leave the moving roster, and a dawn-based clock crosses midnight onto the
 * correct explicit calendar day.
 */
import { DAYS_PER_YEAR } from '../../townsim/constants';
import { ageOf } from '../../townsim/townSim';
import type { LifeEventKind, LivingVillager, TownSimState } from '../../townsim/types';
import {
  advanceAgentLifeDays,
  livingRosterAt,
  replayAgentLifeTo,
  resolveAgentLifeMoment,
} from '../agentLife';
import type { TownRoster } from '../types';

// ============================================================================
// Focused Town Fixtures
// ============================================================================
// One ancient parent guarantees that death and inheritance become visible;
// one fertile married couple can add newborns; one almost-sixteen child proves
// that aging crosses a life-stage boundary and emits a coming-of-age event.
// ============================================================================

function villager(
  values: Partial<LivingVillager> & Pick<LivingVillager, 'occupantId' | 'name' | 'bornDay'>,
): LivingVillager {
  return {
    race: 'Human',
    parentIds: [],
    childIds: [],
    homePlotId: 1,
    wealth: 50,
    ...values,
  };
}

function initialState(): TownSimState {
  const villagers = [
    villager({
      occupantId: 1,
      name: 'Elder Rowan',
      bornDay: -120 * DAYS_PER_YEAR,
      childIds: [2],
      role: 'lord',
      wealth: 90,
    }),
    villager({
      occupantId: 2,
      name: 'Mara Rowan',
      bornDay: -25 * DAYS_PER_YEAR,
      spouseId: 3,
      parentIds: [1],
      homePlotId: 2,
    }),
    villager({
      occupantId: 3,
      name: 'Tomas Vale',
      bornDay: -24 * DAYS_PER_YEAR,
      spouseId: 2,
      homePlotId: 2,
    }),
    villager({
      occupantId: 4,
      name: 'Pip Rowan',
      bornDay: -(16 * DAYS_PER_YEAR - 1),
      parentIds: [2, 3],
      homePlotId: 2,
    }),
  ];

  return {
    burgId: 7,
    villagers: Object.fromEntries(villagers.map((person) => [person.occupantId, person])),
    chronicle: { burgId: 7, events: [], nextEventId: 1 },
    buildingEvents: {},
    prosperity: 50,
    totals: { births: 0, deaths: 0 },
    lastSimDay: 0,
    nextVillagerId: 5,
  };
}

function generatedRoster(): TownRoster {
  return {
    burgId: 7,
    occupants: [
      { id: 1, name: 'Elder Rowan', ageBand: 'elder', homePlotId: 1, occupation: 'resident' },
      { id: 2, name: 'Mara Rowan', ageBand: 'adult', homePlotId: 2, workPlotId: 9, occupation: 'artisan' },
      { id: 3, name: 'Tomas Vale', ageBand: 'adult', homePlotId: 2, occupation: 'resident' },
      { id: 4, name: 'Pip Rowan', ageBand: 'child', homePlotId: 2, occupation: 'resident' },
    ],
  };
}

// ============================================================================
// Clock Semantics
// ============================================================================
// These expectations mirror simulateMindsTo: a target earlier than the replay
// anchor is forward across midnight, and wrapped anchors are equivalent.
// ============================================================================

describe('agent life clock resolution', () => {
  it('keeps arbitrary dayStart and midnight progression explicit', () => {
    expect(resolveAgentLifeMoment({ anchorDay: 10, hour: 6 }, { dayStart: 6 }))
      .toEqual({ day: 10, hour: 6 });
    expect(resolveAgentLifeMoment({ anchorDay: 10, hour: 3 }, { dayStart: 6 }))
      .toEqual({ day: 11, hour: 3 });
    expect(resolveAgentLifeMoment({ anchorDay: 10, hour: 27 }, { dayStart: 30 }))
      .toEqual({ day: 11, hour: 3 });
  });

  it('rejects non-finite moments instead of producing an ambiguous day', () => {
    expect(() => resolveAgentLifeMoment({ anchorDay: 1, hour: Number.NaN }))
      .toThrow(RangeError);
  });
});

// ============================================================================
// Multi-Day Replay And Chronicle Invariants
// ============================================================================
// A per-day seed makes replay independent of how callers chunk elapsed time.
// The core-only mode must never leak the already-built economy, relationship,
// festival, disaster, raid, or building layers into this task's smaller spine.
// ============================================================================

describe('agent life multi-day replay', () => {
  const worldSeed = 24680;
  const targetDay = DAYS_PER_YEAR * 16;
  const allowedKinds = new Set<LifeEventKind>([
    'birth',
    'death',
    'inheritance',
    'came_of_age',
    'role_succession',
  ]);

  it('is pure, deterministic, and chunking-independent', () => {
    const initial = initialState();
    const before = JSON.stringify(initial);

    const direct = advanceAgentLifeDays(initial, worldSeed, targetDay);
    const replay = advanceAgentLifeDays(initial, worldSeed, targetDay);
    const midpoint = advanceAgentLifeDays(initial, worldSeed, DAYS_PER_YEAR * 8);
    const chunked = advanceAgentLifeDays(midpoint, worldSeed, targetDay);

    expect(JSON.stringify(initial)).toBe(before);
    expect(replay).toEqual(direct);
    expect(chunked).toEqual(direct);
  });

  it('emits stable ordered life events and conserves genealogy', () => {
    const state = advanceAgentLifeDays(initialState(), worldSeed, targetDay);
    const events = state.chronicle.events;
    const births = events.filter((event) => event.kind === 'birth');
    const deaths = events.filter((event) => event.kind === 'death');
    const alive = Object.values(state.villagers)
      .filter((person) => person.diedDay === undefined).length;

    expect(events.length).toBeGreaterThan(0);
    expect(events.map((event) => event.id)).toEqual(
      events.map((_, index) => index + 1),
    );
    expect(events.every((event, index) => index === 0 || event.day >= events[index - 1].day))
      .toBe(true);
    expect(events.every((event) => allowedKinds.has(event.kind))).toBe(true);
    expect(state.chronicle.nextEventId).toBe(events.length + 1);

    expect(births.length).toBeGreaterThan(0);
    expect(deaths.some((event) => event.subjectId === 1)).toBe(true);
    expect(events.some((event) => event.kind === 'came_of_age' && event.subjectId === 4))
      .toBe(true);
    expect(state.villagers[1]).toBeDefined();
    expect(state.villagers[1].diedDay).toBeDefined();

    // Every newborn points to both parents, and both parents retain the child.
    for (const birth of births) {
      const child = state.villagers[birth.subjectId];
      expect(child.parentIds).toEqual([2, 3]);
      expect(state.villagers[2].childIds).toContain(child.occupantId);
      expect(state.villagers[3].childIds).toContain(child.occupantId);
    }

    expect(Object.keys(state.villagers).length).toBe(4 + births.length);
    expect(alive).toBe(4 + births.length - deaths.length);
    expect(state.totals).toEqual({ births: births.length, deaths: deaths.length });
    expect(state.prosperity).toBe(50);
    expect(state.buildingEvents).toEqual({});
  });

  it('projects living people into the existing roster without erasing the dead', () => {
    const state = advanceAgentLifeDays(initialState(), worldSeed, targetDay);
    const roster = livingRosterAt(state, generatedRoster(), targetDay);
    const ids = roster.occupants.map((occupant) => occupant.id);

    expect(ids).toEqual([...ids].sort((left, right) => left - right));
    expect(ids).not.toContain(1);
    expect(state.villagers[1]).toBeDefined();

    // Existing work survives the projection, while the once-child resident has
    // aged into the adult band and newborns enter without invented employment.
    expect(roster.occupants.find((occupant) => occupant.id === 2)).toEqual(
      expect.objectContaining({ occupation: 'artisan', workPlotId: 9 }),
    );
    expect(roster.occupants.find((occupant) => occupant.id === 4)?.ageBand).toBe('adult');
    for (const newborn of roster.occupants.filter((occupant) => occupant.id >= 5)) {
      expect(newborn.occupation).toBe('resident');
      expect(newborn.workPlotId).toBeUndefined();
    }

    expect(ageOf(state.villagers[4], targetDay)).toBeGreaterThanOrEqual(16);
  });
});

// ============================================================================
// One-Call Replay Surface
// ============================================================================
// This verifies that the same wrapped dawn anchor resolves to the same state
// and roster, and that replay cannot silently travel backward through history.
// ============================================================================

describe('agent life snapshot replay', () => {
  it('replays equivalent wrapped anchors to the same next-day snapshot', () => {
    const first = replayAgentLifeTo(
      initialState(),
      generatedRoster(),
      99,
      { anchorDay: 10, hour: 3 },
      { dayStart: 6 },
    );
    const wrapped = replayAgentLifeTo(
      initialState(),
      generatedRoster(),
      99,
      { anchorDay: 10, hour: 27 },
      { dayStart: 30 },
    );

    expect(first.day).toBe(11);
    expect(first.hour).toBe(3);
    expect(wrapped).toEqual(first);
  });

  it('requires callers to replay backward from an earlier saved state', () => {
    const advanced = advanceAgentLifeDays(initialState(), 99, 20);
    expect(() => advanceAgentLifeDays(advanced, 99, 19)).toThrow(RangeError);
  });
});
