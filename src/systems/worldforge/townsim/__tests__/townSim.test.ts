import { SeededRandom } from '../../../../utils/random/seededRandom';
import { initTownSimState, ageOf, rollTownDay, advanceTownDays } from '../townSim';
import type { TownSimState, LivingVillager } from '../types';
import { DAYS_PER_YEAR } from '../constants';
import { generateTownRoster } from '../../roster/generateTownRoster';
import { assignFamilies } from '../../roster/family';
import { makeSeedPath } from '../../seedPath';
import { buildDemoTownPlan } from '../../town/demoTownPlan';

// Minimal hand-built state factory (bypasses roster for focused unit tests).
function villager(p: Partial<LivingVillager> & { occupantId: number }): LivingVillager {
  return {
    name: `V${p.occupantId}`,
    race: 'Human',
    bornDay: -30 * DAYS_PER_YEAR,
    parentIds: [],
    childIds: [],
    homePlotId: 1,
    wealth: 50,
    ...p,
  };
}

function stateOf(vs: LivingVillager[], startDay = 0): TownSimState {
  const villagers: Record<number, LivingVillager> = {};
  for (const v of vs) villagers[v.occupantId] = v;
  return {
    burgId: 1,
    villagers,
    chronicle: { burgId: 1, events: [], nextEventId: 1 },
    lastSimDay: startDay,
    nextVillagerId: Math.max(...vs.map((v) => v.occupantId)) + 1,
  };
}

describe('townSim ageOf', () => {
  it('derives integer age from bornDay', () => {
    const v = villager({ occupantId: 1, bornDay: 0 });
    expect(ageOf(v, 0)).toBe(0);
    expect(ageOf(v, DAYS_PER_YEAR * 5 + 10)).toBe(5);
  });
});

describe('rollTownDay determinism + purity', () => {
  it('same state + same seed → identical result', () => {
    const s = stateOf([villager({ occupantId: 1 }), villager({ occupantId: 2 })]);
    const a = rollTownDay(s, 1, new SeededRandom(99));
    const b = rollTownDay(s, 1, new SeededRandom(99));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('does not mutate the input state', () => {
    const s = stateOf([villager({ occupantId: 1 })]);
    const snap = JSON.stringify(s);
    rollTownDay(s, 1, new SeededRandom(7));
    expect(JSON.stringify(s)).toBe(snap);
  });
});

describe('death + succession + inheritance', () => {
  it('an ancient role-holder dies, an heir succeeds, wealth is inherited', () => {
    const lord = villager({
      occupantId: 1,
      bornDay: -95 * DAYS_PER_YEAR,
      role: 'lord',
      wealth: 100,
      childIds: [2],
    });
    const heir = villager({
      occupantId: 2,
      bornDay: -30 * DAYS_PER_YEAR,
      parentIds: [1],
      wealth: 10,
    });
    let s = stateOf([lord, heir]);
    s = advanceTownDays(s, 0, 400, new SeededRandom(42));
    const deadLord = s.villagers[1];
    const newHeir = s.villagers[2];
    expect(deadLord.diedDay).toBeDefined();
    expect(newHeir.role).toBe('lord'); // succession
    expect(newHeir.wealth).toBeGreaterThan(10); // inheritance bumped meter
    const kinds = s.chronicle.events.map((e) => e.kind);
    expect(kinds).toContain('death');
    expect(kinds).toContain('role_succession');
    expect(kinds).toContain('inheritance');
  });

  it('a vacated role lapses rather than overwriting another institution', () => {
    // Ancient lord + a younger priest who will survive. When the lord dies the
    // only survivor already holds a role, so 'lord' must LAPSE — the priest must
    // keep 'priest' (not be silently clobbered into 'lord').
    const lord = villager({ occupantId: 1, bornDay: -99 * DAYS_PER_YEAR, role: 'lord' });
    const priest = villager({ occupantId: 2, bornDay: -25 * DAYS_PER_YEAR, role: 'priest' });
    let s = stateOf([lord, priest]);
    s = advanceTownDays(s, 0, 1000, new SeededRandom(42));
    expect(s.villagers[1].diedDay).toBeDefined(); // the ancient lord died
    expect(s.villagers[2].role).toBe('priest'); // priest NOT cannibalized into lord
    const livingLords = Object.values(s.villagers).filter(
      (v) => v.role === 'lord' && v.diedDay === undefined,
    );
    expect(livingLords.length).toBe(0); // lord role lapsed, not stolen from priest
  });

  it('a role is never left empty while any roleless villager survives', () => {
    const lord = villager({ occupantId: 1, bornDay: -99 * DAYS_PER_YEAR, role: 'lord' });
    const other = villager({ occupantId: 2, bornDay: -25 * DAYS_PER_YEAR });
    let s = stateOf([lord, other]);
    s = advanceTownDays(s, 0, 600, new SeededRandom(3));
    if (s.villagers[1].diedDay !== undefined) {
      // someone must now hold the lord role
      const holders = Object.values(s.villagers).filter(
        (v) => v.role === 'lord' && v.diedDay === undefined,
      );
      expect(holders.length).toBe(1);
    }
  });
});

describe('births', () => {
  it('a fertile married couple eventually has children over a decade', () => {
    const a = villager({ occupantId: 1, bornDay: -25 * DAYS_PER_YEAR, spouseId: 2 });
    const b = villager({ occupantId: 2, bornDay: -24 * DAYS_PER_YEAR, spouseId: 1 });
    let s = stateOf([a, b]);
    s = advanceTownDays(s, 0, DAYS_PER_YEAR * 10, new SeededRandom(5));
    const births = s.chronicle.events.filter((e) => e.kind === 'birth');
    expect(births.length).toBeGreaterThan(0);
    const child = s.villagers[births[0].subjectId];
    expect(child.parentIds.slice().sort()).toEqual([1, 2]);
    expect(s.villagers[1].childIds).toContain(child.occupantId);
    expect(s.villagers[2].childIds).toContain(child.occupantId);
  });

  it('the dead do not give birth', () => {
    // both spouses ancient → they die before producing many kids; no birth after death day
    const a = villager({ occupantId: 1, bornDay: -99 * DAYS_PER_YEAR, spouseId: 2 });
    const b = villager({ occupantId: 2, bornDay: -99 * DAYS_PER_YEAR, spouseId: 1 });
    let s = stateOf([a, b]);
    s = advanceTownDays(s, 0, 800, new SeededRandom(11));
    const deathDay = Math.min(
      s.villagers[1].diedDay ?? Infinity,
      s.villagers[2].diedDay ?? Infinity,
    );
    const births = s.chronicle.events.filter((e) => e.kind === 'birth');
    for (const birth of births) expect(birth.day).toBeLessThan(deathDay);
  });
});

describe('coming of age', () => {
  it('a child crossing comingOfAge emits exactly one came_of_age event', () => {
    const kid = villager({ occupantId: 1, bornDay: -(16 * DAYS_PER_YEAR - 2) }); // turns 16 in 2 days
    let s = stateOf([kid]);
    // seed 12345: first draws are well above the tiny baseline death chance,
    // so the child survives to its coming-of-age day (seed 1 would kill it on day 1).
    s = advanceTownDays(s, 0, 5, new SeededRandom(12345));
    const coa = s.chronicle.events.filter((e) => e.kind === 'came_of_age');
    expect(coa.length).toBe(1);
  });
});

// Build a real sim state from the demo Voronoi town's roster + families.
function realInit(worldSeed: number, population: number) {
  const demo = buildDemoTownPlan(worldSeed, { burgId: 1, population });
  const roster = generateTownRoster(demo.plan, makeSeedPath(worldSeed, 'burg:1', 's:roster'), {
    nameFor: (rng) => `N${Math.floor(rng.next() * 1e6)}`,
  });
  const families = assignFamilies(roster.occupants, makeSeedPath(worldSeed, 'burg:1', 's:family'));
  return { roster, state: initTownSimState(1, roster, families, new Map(), 0) };
}

describe('initTownSimState (real roster + families)', () => {
  it('builds one living villager per occupant with derived bornDay/race', () => {
    const { roster, state } = realInit(1337, 200);
    expect(Object.keys(state.villagers).length).toBe(roster.occupants.length);
    const any = Object.values(state.villagers)[0];
    expect(any.bornDay).toBeLessThanOrEqual(0);
    expect(typeof any.race).toBe('string');
    expect(state.lastSimDay).toBe(0);
  });
});

describe('20-year run: determinism + ledger conservation', () => {
  it('is reproducible and conserves the population ledger', () => {
    const { roster, state: init } = realInit(2024, 150);
    const run = () => advanceTownDays(init, 0, DAYS_PER_YEAR * 20, new SeededRandom(2024));
    const a = run();
    const b = run();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // determinism

    const births = a.chronicle.events.filter((e) => e.kind === 'birth').length;
    const deaths = a.chronicle.events.filter((e) => e.kind === 'death').length;
    const alive = Object.values(a.villagers).filter((v) => v.diedDay === undefined).length;

    // every birth created a registered villager; nobody vanished
    expect(Object.keys(a.villagers).length).toBe(roster.occupants.length + births);
    // alive = started + born - died
    expect(alive).toBe(roster.occupants.length + births - deaths);
    // no negative wealth meters
    for (const v of Object.values(a.villagers)) expect(v.wealth).toBeGreaterThanOrEqual(0);
    // something actually happened over two decades
    expect(a.chronicle.events.length).toBeGreaterThan(0);
  });
});
