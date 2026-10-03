/**
 * These tests protect the optional deepened mode on the agent-life replay seam.
 *
 * A small hand-built town makes each promised layer observable: housemates grow
 * close enough to marry, two negatively matched colleagues become rivals, shops
 * earn bounded income while poor homes lose purchasing power, and the calendar
 * records festivals plus fire, crime, and weather. The suite also proves direct
 * and resumed replay equality, stable chronicle ordering, bounded long-run state,
 * and the original birth/death/genealogy conservation rules.
 */
import { DAYS_PER_YEAR, RETENTION_YEARS } from '../../townsim/constants';
import type { LivingVillager, TownSimState } from '../../townsim/types';
import {
  advanceAgentLifeDays,
  replayAgentLifeTo,
} from '../agentLife';
import type { TownRoster } from '../types';

// ============================================================================
// Deterministic Deepening Fixture
// ============================================================================
// IDs 1 and 2 share a home but not a workplace, so their daily companionship is
// steadily positive. IDs 3 and 6 share one workplace and have pinned negative
// chemistry for this seed, making the rivalry path deterministic rather than
// probabilistic. An old parent and a married couple keep inheritance and births
// active while the new layers progress.
// ============================================================================

const WORLD_SEED = 24_680;
const BURG_ID = 7;

function villager(
  values: Partial<LivingVillager> & Pick<LivingVillager, 'occupantId' | 'name' | 'bornDay'>,
): LivingVillager {
  return {
    race: 'Human',
    parentIds: [],
    childIds: [],
    homePlotId: values.occupantId,
    wealth: 50,
    ...values,
  };
}

function initialState(): TownSimState {
  const villagers = [
    villager({ occupantId: 1, name: 'Ada Fen', bornDay: -25 * DAYS_PER_YEAR, homePlotId: 1 }),
    villager({ occupantId: 2, name: 'Bram Holt', bornDay: -26 * DAYS_PER_YEAR, homePlotId: 1 }),
    villager({ occupantId: 3, name: 'Cora Reed', bornDay: -31 * DAYS_PER_YEAR, homePlotId: 3 }),
    villager({ occupantId: 6, name: 'Dain Moss', bornDay: -29 * DAYS_PER_YEAR, homePlotId: 6 }),
    villager({
      occupantId: 7,
      name: 'Eda Rowan',
      bornDay: -28 * DAYS_PER_YEAR,
      spouseId: 8,
      parentIds: [10],
      childIds: [9],
      homePlotId: 7,
    }),
    villager({
      occupantId: 8,
      name: 'Finn Rowan',
      bornDay: -29 * DAYS_PER_YEAR,
      spouseId: 7,
      childIds: [9],
      homePlotId: 7,
    }),
    villager({
      occupantId: 9,
      name: 'Gilly Rowan',
      bornDay: -8 * DAYS_PER_YEAR,
      parentIds: [7, 8],
      homePlotId: 7,
    }),
    villager({
      occupantId: 10,
      name: 'Hale Rowan',
      bornDay: -110 * DAYS_PER_YEAR,
      childIds: [7],
      homePlotId: 10,
      wealth: 200,
    }),
  ];

  return {
    burgId: BURG_ID,
    villagers: Object.fromEntries(villagers.map((person) => [person.occupantId, person])),
    chronicle: { burgId: BURG_ID, events: [], nextEventId: 1 },
    buildingEvents: {},
    prosperity: 50,
    totals: { births: 0, deaths: 0 },
    lastSimDay: 0,
    nextVillagerId: 11,
  };
}

function roster(): TownRoster {
  return {
    burgId: BURG_ID,
    occupants: [
      { id: 1, name: 'Ada Fen', ageBand: 'adult', homePlotId: 1, workPlotId: 11, occupation: 'shopkeeper' },
      { id: 2, name: 'Bram Holt', ageBand: 'adult', homePlotId: 1, workPlotId: 12, occupation: 'artisan' },
      { id: 3, name: 'Cora Reed', ageBand: 'adult', homePlotId: 3, workPlotId: 20, occupation: 'artisan' },
      { id: 6, name: 'Dain Moss', ageBand: 'adult', homePlotId: 6, workPlotId: 20, occupation: 'artisan' },
      { id: 7, name: 'Eda Rowan', ageBand: 'adult', homePlotId: 7, occupation: 'resident' },
      { id: 8, name: 'Finn Rowan', ageBand: 'adult', homePlotId: 7, occupation: 'resident' },
      { id: 9, name: 'Gilly Rowan', ageBand: 'child', homePlotId: 7, occupation: 'resident' },
      { id: 10, name: 'Hale Rowan', ageBand: 'elder', homePlotId: 10, occupation: 'resident' },
    ],
  };
}

function deepen(state: TownSimState, targetDay: number): TownSimState {
  return advanceAgentLifeDays(state, WORLD_SEED, targetDay, {
    mode: 'deepened',
    roster: roster(),
  });
}

// ============================================================================
// Replay And Ordering
// ============================================================================
// Per-day named streams mean a direct run and a save resumed at an arbitrary
// midpoint must be byte-for-byte equal. The original state remains untouched.
// ============================================================================

describe('deepened agent-life replay', () => {
  it('is pure, deterministic, and independent of replay chunk size', () => {
    const source = initialState();
    const before = JSON.stringify(source);
    const targetDay = 3 * DAYS_PER_YEAR;

    const direct = deepen(source, targetDay);
    const repeated = deepen(source, targetDay);
    const midpoint = deepen(source, DAYS_PER_YEAR + 47);
    const resumed = deepen(midpoint, targetDay);

    expect(JSON.stringify(source)).toBe(before);
    expect(repeated).toEqual(direct);
    expect(resumed).toEqual(direct);
  });

  it('requires a roster for the richer mode and carries it through one-call replay', () => {
    expect(() => advanceAgentLifeDays(initialState(), WORLD_SEED, 1, { mode: 'deepened' }))
      .toThrow('requires the generated town roster');

    const snapshot = replayAgentLifeTo(
      initialState(),
      roster(),
      WORLD_SEED,
      { anchorDay: 20, hour: 3 },
      { dayStart: 6, mode: 'deepened' },
    );

    expect(snapshot.day).toBe(21);
    expect(snapshot.state.agentDeepening?.economy.lastUpdatedDay).toBe(21);
    expect(snapshot.roster.occupants.map((occupant) => occupant.id))
      .toEqual(snapshot.roster.occupants.map((occupant) => occupant.id).sort((a, b) => a - b));
  });
});

// ============================================================================
// Economy, Relationships, And Town Events
// ============================================================================
// One multi-year run must expose all three layers in the same canonical state:
// non-uniform district wealth and shop takings; friendship, rivalry, courtship,
// and marriage; and calendar plus incident entries in stable id/day order.
// ============================================================================

describe('deepened progression', () => {
  it('builds a bounded local economy with rich and poor homes', () => {
    const state = deepen(initialState(), 3 * DAYS_PER_YEAR);
    const economy = state.agentDeepening!.economy;
    const districtValues = Object.values(economy.districtWealthByHomePlot);

    expect(economy.priceIndex).toBeGreaterThanOrEqual(60);
    expect(economy.priceIndex).toBeLessThanOrEqual(180);
    expect(economy.shopIncomeByPlot[11]).toBeGreaterThan(0);
    expect(new Set(districtValues).size).toBeGreaterThan(1);
    expect(state.chronicle.events.some((event) => event.kind === 'economy')).toBe(true);
    for (const person of Object.values(state.villagers)) {
      expect(person.wealth).toBeGreaterThanOrEqual(0);
      expect(person.wealth).toBeLessThanOrEqual(1_000);
    }
  });

  it('turns repeated contact into friendship, rivalry, courtship, and marriage', () => {
    const state = deepen(initialState(), 3 * DAYS_PER_YEAR);
    const relationships = state.agentDeepening!.relationships;

    expect(relationships['1:2']).toEqual(expect.objectContaining({
      affinity: 100,
      status: 'friend',
    }));
    expect(relationships['3:6']).toEqual(expect.objectContaining({
      affinity: -100,
      status: 'rival',
    }));
    expect(state.chronicle.events.some((event) =>
      event.kind === 'courtship' && event.subjectId === 1 && event.relatedIds.includes(2)))
      .toBe(true);
    expect(state.chronicle.events.some((event) =>
      event.kind === 'marriage' && event.subjectId === 1 && event.relatedIds.includes(2)))
      .toBe(true);
    expect(state.villagers[1].spouseId).toBe(2);
    expect(state.villagers[2].spouseId).toBe(1);
  });

  it('records festivals plus fire, crime, and weather in stable order', () => {
    const state = deepen(initialState(), 6 * DAYS_PER_YEAR);
    const events = state.chronicle.events;
    const summaries = events.map((event) => event.summary);

    expect(events.some((event) => event.kind === 'festival')).toBe(true);
    expect(summaries).toContain('A fire swept through the town.');
    expect(summaries).toContain('A crime wave troubled the town.');
    expect(summaries.some((summary) =>
      summary.includes('storms') || summary.includes('dry spell') || summary.includes('cold snap')))
      .toBe(true);
    expect(events.every((event, index) => index === 0 || event.day >= events[index - 1].day))
      .toBe(true);
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
    expect(events.every((event, index) => index === 0 || event.id > events[index - 1].id))
      .toBe(true);
    expect(state.chronicle.nextEventId).toBeGreaterThan(events.at(-1)?.id ?? 0);
  });
});

// ============================================================================
// Long-Run Bounds And Genealogy
// ============================================================================
// Deepening may change who marries and therefore who is born, but it must never
// bypass the original ledger: every birth is a stored person with reciprocal
// parent links, every death remains stored, and alive population still balances.
// ============================================================================

describe('deepened long-run invariants', () => {
  it('bounds retained state while preserving the population and genealogy ledger', () => {
    const initial = initialState();
    const initialPopulation = Object.keys(initial.villagers).length;
    const targetDay = 12 * DAYS_PER_YEAR;
    const state = deepen(initial, targetDay);
    const living = Object.values(state.villagers)
      .filter((person) => person.diedDay === undefined);
    const bonds = Object.values(state.agentDeepening!.relationships);
    const knownWorkPlots = new Set(roster().occupants
      .map((occupant) => occupant.workPlotId)
      .filter((plotId): plotId is number => plotId !== undefined));

    expect(Object.keys(state.villagers).length)
      .toBe(initialPopulation + state.totals!.births);
    expect(living.length)
      .toBe(initialPopulation + state.totals!.births - state.totals!.deaths);

    for (const child of Object.values(state.villagers).filter((person) => person.occupantId >= 11)) {
      expect(child.parentIds.length).toBe(2);
      for (const parentId of child.parentIds) {
        expect(state.villagers[parentId].childIds).toContain(child.occupantId);
      }
    }

    expect(bonds.length).toBeLessThanOrEqual(living.length * 4);
    expect(bonds.every((bond) => bond.contactDays <= 10_000)).toBe(true);
    expect(Object.keys(state.agentDeepening!.economy.shopIncomeByPlot)
      .every((plotId) => knownWorkPlots.has(Number(plotId))))
      .toBe(true);
    expect(Object.values(state.agentDeepening!.economy.shopIncomeByPlot)
      .every((income) => income >= 0 && income <= 100_000))
      .toBe(true);

    const cutoff = targetDay - RETENTION_YEARS * DAYS_PER_YEAR;
    expect(state.chronicle.events.every((event) => event.day >= cutoff)).toBe(true);
    expect(state.villagers[10]).toBeDefined();
    expect(state.villagers[10].diedDay).toBeDefined();
  });
});
