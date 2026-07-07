import { SeededRandom } from '../../../../utils/random/seededRandom';
import { initTownSimState, ageOf, rollTownDay, advanceTownDays } from '../townSim';
import { advanceTown } from '../townSimRegistry';
import type { TownSimState, LivingVillager } from '../types';
import { DAYS_PER_YEAR, RETENTION_YEARS } from '../constants';
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

describe('rollTownDay raid-worry (Pillar 2 Task 8)', () => {
  // Count raid_worry events across a long window of forced pressure.
  function worryLinesOver(days: number, raidPressure: number, worldSeed = 42): string[] {
    let s = stateOf([villager({ occupantId: 1 }), villager({ occupantId: 2 })]);
    const lines: string[] = [];
    for (let day = 1; day <= days; day++) {
      s = rollTownDay(s, day, new SeededRandom(1000 + day), { worldSeed, raidPressure });
      for (const e of s.chronicle.events) {
        if (e.kind === 'raid_worry' && e.day === day) lines.push(e.summary);
      }
    }
    return lines;
  }

  it('emits at least one raid-worry line under sustained HIGH pressure', () => {
    const lines = worryLinesOver(200, 1);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0].length).toBeGreaterThan(0);
  });

  it('emits NO raid-worry line below the pressure floor', () => {
    expect(worryLinesOver(200, 0.1)).toEqual([]);
  });

  it('omitting opts is byte-identical to the pre-Task-8 roll (no extra draws)', () => {
    const s = stateOf([villager({ occupantId: 1 }), villager({ occupantId: 2 })]);
    const without = rollTownDay(s, 1, new SeededRandom(99));
    const withZero = rollTownDay(s, 1, new SeededRandom(99), { worldSeed: 42, raidPressure: 0 });
    expect(JSON.stringify(withZero)).toBe(JSON.stringify(without));
  });

  it('the raid-worry roll does not perturb the life-event stream', () => {
    // A life-event roll under HIGH pressure produces the same villagers/wealth/
    // (non-raid) events as one with NO pressure — only raid_worry lines differ.
    const s = stateOf([villager({ occupantId: 1 }), villager({ occupantId: 2 })]);
    const strip = (st: TownSimState) => ({
      ...st,
      chronicle: {
        ...st.chronicle,
        events: st.chronicle.events.filter((e) => e.kind !== 'raid_worry'),
      },
    });
    const calm = rollTownDay(s, 5, new SeededRandom(77), { worldSeed: 42, raidPressure: 0 });
    const beset = rollTownDay(s, 5, new SeededRandom(77), { worldSeed: 42, raidPressure: 1 });
    // nextEventId can differ (a worry line consumes an id), so compare on the
    // life-event content, not the counter.
    const c = strip(calm);
    const b = strip(beset);
    expect(JSON.stringify(b.villagers)).toBe(JSON.stringify(c.villagers));
    expect(JSON.stringify(b.chronicle.events)).toBe(JSON.stringify(c.chronicle.events));
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

describe('relationships: courtship → marriage', () => {
  it('two unrelated single adults court and then marry', () => {
    const a = villager({ occupantId: 1, bornDay: -25 * DAYS_PER_YEAR });
    const b = villager({ occupantId: 2, bornDay: -26 * DAYS_PER_YEAR });
    let s = stateOf([a, b]);
    s = advanceTownDays(s, 0, DAYS_PER_YEAR * 6, new SeededRandom(7));
    const kinds = s.chronicle.events.map((e) => e.kind);
    expect(kinds).toContain('courtship');
    expect(kinds).toContain('marriage');
    expect(s.villagers[1].spouseId).toBe(2);
    expect(s.villagers[2].spouseId).toBe(1);
    expect(s.villagers[1].courtingId).toBeUndefined();
  });

  it('siblings never court or marry each other', () => {
    // both children of the same (off-roster) parent → siblings
    const a = villager({ occupantId: 1, bornDay: -25 * DAYS_PER_YEAR, parentIds: [99] });
    const b = villager({ occupantId: 2, bornDay: -24 * DAYS_PER_YEAR, parentIds: [99] });
    let s = stateOf([a, b]);
    s = advanceTownDays(s, 0, DAYS_PER_YEAR * 15, new SeededRandom(7));
    expect(s.chronicle.events.some((e) => e.kind === 'marriage')).toBe(false);
    expect(s.villagers[1].spouseId).toBeUndefined();
    expect(s.villagers[2].spouseId).toBeUndefined();
  });

  it('a courtship ends if the partner dies before marrying', () => {
    // one young, one ancient: they may court, but the ancient dies mid-courtship
    const young = villager({ occupantId: 1, bornDay: -25 * DAYS_PER_YEAR });
    const old = villager({ occupantId: 2, bornDay: -59 * DAYS_PER_YEAR }); // within marriageable (<60.8), high death
    let s = stateOf([young, old]);
    s = advanceTownDays(s, 0, DAYS_PER_YEAR * 20, new SeededRandom(3));
    // the young survivor must not be left dangling in a courtship with a corpse
    if (s.villagers[2].diedDay !== undefined && s.villagers[1].spouseId === undefined) {
      expect(s.villagers[1].courtingId).toBeUndefined();
    }
  });
});

describe('event-grained economy', () => {
  it('emits economy events over the years, moves wealth, and keeps it non-negative', () => {
    const a = villager({ occupantId: 1, bornDay: -25 * DAYS_PER_YEAR, wealth: 50, spouseId: 2 });
    const b = villager({ occupantId: 2, bornDay: -25 * DAYS_PER_YEAR, wealth: 50, spouseId: 1 });
    let s = stateOf([a, b]);
    s = advanceTownDays(s, 0, DAYS_PER_YEAR * 30, new SeededRandom(2024));
    const econ = s.chronicle.events.filter((e) => e.kind === 'economy');
    expect(econ.length).toBeGreaterThan(0); // some years had economic events
    expect(typeof s.prosperity).toBe('number');
    expect(s.prosperity!).toBeGreaterThanOrEqual(0);
    expect(s.prosperity!).toBeLessThanOrEqual(100);
    for (const v of Object.values(s.villagers)) expect(v.wealth).toBeGreaterThanOrEqual(0);
  });

  it('economy events are town-level (no personal subject)', () => {
    const a = villager({ occupantId: 1, bornDay: -25 * DAYS_PER_YEAR });
    let s = stateOf([a]);
    s = advanceTownDays(s, 0, DAYS_PER_YEAR * 20, new SeededRandom(2024));
    for (const e of s.chronicle.events.filter((ev) => ev.kind === 'economy')) {
      expect(e.subjectId).toBe(0);
      expect(e.summary.length).toBeGreaterThan(0);
    }
  });
});

describe('relationships fix the demographic decline', () => {
  it('a real town sustains births into its later decades', () => {
    const { state: init } = realInit(4242, 200);
    const s = advanceTownDays(init, 0, DAYS_PER_YEAR * 60, new SeededRandom(4242));
    const marriages = s.chronicle.events.filter((e) => e.kind === 'marriage').length;
    const lateBirths = s.chronicle.events.filter((e) => e.kind === 'birth' && e.day > DAYS_PER_YEAR * 40).length;
    expect(marriages).toBeGreaterThan(0); // new couples form
    expect(lateBirths).toBeGreaterThan(0); // population still reproducing after 40 years
  });
});

describe('recurring festivals', () => {
  it('emits town-level festival events that recur each year', () => {
    const a = villager({ occupantId: 1, bornDay: -25 * DAYS_PER_YEAR });
    let s = stateOf([a]);
    s = advanceTownDays(s, 0, DAYS_PER_YEAR * 6, new SeededRandom(2024));
    const fests = s.chronicle.events.filter((e) => e.kind === 'festival');
    expect(fests.length).toBeGreaterThan(0);
    for (const e of fests) {
      expect(e.subjectId).toBe(0); // town-level
      expect(e.summary.length).toBeGreaterThan(0);
    }
  });

  it('festival count grows roughly linearly with the number of years simulated', () => {
    const make = () => stateOf([villager({ occupantId: 1, bornDay: -25 * DAYS_PER_YEAR })]);
    const countOver = (years: number) => {
      const s = advanceTownDays(make(), 0, DAYS_PER_YEAR * years, new SeededRandom(2024));
      return s.chronicle.events.filter((e) => e.kind === 'festival').length;
    };
    const f4 = countOver(4);
    const f8 = countOver(8);
    expect(f4).toBeGreaterThan(0);
    // ~doubling the years ~doubles the festivals (recurrence is annual & fixed).
    expect(f8).toBe(f4 * 2);
  });

  it('adding festivals did not break determinism (same seed → identical state)', () => {
    const run = () => {
      const s = stateOf([
        villager({ occupantId: 1, bornDay: -25 * DAYS_PER_YEAR, spouseId: 2 }),
        villager({ occupantId: 2, bornDay: -25 * DAYS_PER_YEAR, spouseId: 1 }),
      ]);
      return advanceTownDays(s, 0, DAYS_PER_YEAR * 10, new SeededRandom(2024));
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});

describe('town-scale events', () => {
  // A multi-decade run on a real town will, with overwhelming probability, see
  // at least one rare disaster. We assert the invariants disasters MUST respect:
  // disaster deaths look exactly like natural ones (population conservation),
  // institutions are still succeeded, and the whole run stays deterministic.
  it('a long run suffers at least one disaster and conserves the ledger', () => {
    const { roster, state: init } = realInit(2024, 200);
    const run = () => advanceTownDays(init, 0, DAYS_PER_YEAR * 80, new SeededRandom(2024));
    const a = run();
    const b = run();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // determinism

    const disasters = a.chronicle.events.filter((e) => e.kind === 'disaster');
    expect(disasters.length).toBeGreaterThan(0); // a disaster actually struck
    for (const d of disasters) {
      expect(d.subjectId).toBe(0); // town-level announcement
      expect(d.summary.length).toBeGreaterThan(0);
    }

    // Population conservation still holds — disaster deaths emitted 'death'
    // events, so nobody vanished off the books.
    const births = a.chronicle.events.filter((e) => e.kind === 'birth').length;
    const deaths = a.chronicle.events.filter((e) => e.kind === 'death').length;
    const alive = Object.values(a.villagers).filter((v) => v.diedDay === undefined).length;
    expect(Object.keys(a.villagers).length).toBe(roster.occupants.length + births);
    expect(alive).toBe(roster.occupants.length + births - deaths);
    for (const v of Object.values(a.villagers)) expect(v.wealth).toBeGreaterThanOrEqual(0);

    // Institutions are never orphaned: because disaster deaths flow through the
    // SAME killVillager path as natural deaths, succession ran for every death
    // (disaster victims included), so no dead villager still holds a role.
    for (const v of Object.values(a.villagers)) {
      if (v.diedDay !== undefined) expect(v.role).toBeUndefined();
    }
  }, 20000); // multi-decade sim run twice (determinism) — needs headroom

  it('a disaster death produces a death event indistinguishable from a natural one', () => {
    // Smoke-check the disaster→killVillager wiring on a small, fast town: a
    // disaster summary mentions the kind, and every 'death' event (disaster or
    // natural) carries the standard shape (personal subject, no relatedIds).
    const { state: init } = realInit(2024, 60);
    const s = advanceTownDays(init, 0, DAYS_PER_YEAR * 80, new SeededRandom(2024));
    const disasters = s.chronicle.events.filter((e) => e.kind === 'disaster');
    expect(disasters.length).toBeGreaterThan(0);
    for (const d of s.chronicle.events.filter((e) => e.kind === 'death')) {
      expect(d.subjectId).toBeGreaterThan(0); // a real villager died
      expect(d.relatedIds).toEqual([]);
    }
  }, 20000);
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

    // advanceTownDays does not prune, so cumulative totals match the event counts
    expect(a.totals).toEqual({ births, deaths });
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

describe('chronicle retention (bounded save growth)', () => {
  it('advanceTown prunes old events to the retention window but preserves cumulative totals', () => {
    const { state: init } = realInit(909, 120);
    // 25 years via the production (pruning) path.
    const a = advanceTown(init, 909, DAYS_PER_YEAR * 25);

    // No event older than the retention window survives...
    const cutoff = DAYS_PER_YEAR * 25 - RETENTION_YEARS * DAYS_PER_YEAR;
    expect(a.chronicle.events.every((e) => e.day >= cutoff)).toBe(true);
    // ...yet there ARE recent events (the town didn't go silent).
    expect(a.chronicle.events.length).toBeGreaterThan(0);
    // Cumulative totals survive pruning and still satisfy the population ledger.
    const alive = Object.values(a.villagers).filter((v) => v.diedDay === undefined).length;
    const started = Object.keys(init.villagers).length;
    expect(alive).toBe(started + a.totals!.births - a.totals!.deaths);
    // Determinism preserved through pruning.
    const b = advanceTown(init, 909, DAYS_PER_YEAR * 25);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
