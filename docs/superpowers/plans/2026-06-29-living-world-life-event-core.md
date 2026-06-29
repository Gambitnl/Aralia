# Living-World Sim — Life-Event Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure, deterministic engine that ages a town's tracked villagers over many days and emits life events (death, inheritance, birth, coming-of-age, role succession) into an append-only chronicle with cached wealth meters.

**Architecture:** A new pure module `src/systems/worldforge/townsim/` layered on top of the existing roster/family substrate. No game-state wiring, no React, no I/O — just `TownSimState → advance N days → new TownSimState + chronicle`. Rolls take a `SeededRandom` parameter so production can seed path-dependently (per design D6) while tests pin a fixed seed. This is the foundation; all later content layers (economy, relationships, festivals) pour events into the same chronicle/meter machinery.

**Tech Stack:** TypeScript, Vitest (globals:true), `SeededRandom` (Park-Miller, `nextInt` max-EXCLUSIVE), `seedPath` helpers. Existing types: `Occupant`/`TownRoster` (`roster/types.ts`), `FamilyTies` (`roster/family.ts`).

**Design source:** `docs/projects/worldforge/LIVING_WORLD_SIM_SPEC.md` (D7 diary+meters, D8 event-grained, §5 construction order item 1: life-event substrate first).

---

## File Structure

- `src/systems/worldforge/townsim/types.ts` — data contracts: `LifeEvent`, `LifeEventKind`, `LivingVillager`, `InstitutionRole`, `TownChronicle`, `TownSimState`.
- `src/systems/worldforge/townsim/constants.ts` — `DAYS_PER_YEAR` and sim tuning constants.
- `src/systems/worldforge/townsim/lifespans.ts` — per-race lifespan table + `lifespanForRace`, `dailyDeathProbability`, `childbearingWindow`.
- `src/systems/worldforge/townsim/townSim.ts` — `initTownSimState`, `ageOf`, `rollTownDay`, `advanceTownDays`, `villagerDiary`.
- `src/systems/worldforge/townsim/chronicle.ts` — `summarizeChronicle` (year-grouped plain-English history).
- `src/systems/worldforge/townsim/__tests__/lifespans.test.ts`
- `src/systems/worldforge/townsim/__tests__/townSim.test.ts`
- `src/systems/worldforge/townsim/__tests__/chronicle.test.ts`

---

## Task 1: Data contracts (types.ts + constants.ts)

**Files:**
- Create: `src/systems/worldforge/townsim/types.ts`
- Create: `src/systems/worldforge/townsim/constants.ts`

- [ ] **Step 1: Write constants.ts**

```ts
/** Days per game year for sim age math. The calendar is Date-based (~365.25);
 * the sim uses a fixed 365 for deterministic integer age arithmetic. */
export const DAYS_PER_YEAR = 365;

/** Tiny baseline daily death chance in youth (illness/accident). */
export const BASELINE_DAILY_DEATH = 0.00002;
/** Max number of children a couple will produce in the sim. */
export const MAX_CHILDREN = 6;
/** Annual probability a fertile married couple produces a child. */
export const ANNUAL_BIRTH_CHANCE = 0.22;
/** Baseline starting wealth meter for a pre-existing adult villager. */
export const BASELINE_WEALTH = 50;
```

- [ ] **Step 2: Write types.ts**

```ts
/**
 * Data contracts for the living-world town sim (life-event core).
 * Diary = append-only LifeEvent[] (source of truth, D7).
 * Meters (wealth) are cached on LivingVillager, only moved when an event
 * is written (D7: "the diary writes, the meter ticks").
 */

export type LifeEventKind =
  | 'birth'
  | 'death'
  | 'inheritance'
  | 'came_of_age'
  | 'role_succession';
// economy / relationship / festival kinds are added by later plans.

export interface LifeEvent {
  /** Monotonic id within a town's chronicle. */
  id: number;
  /** gameDay the event occurred. */
  day: number;
  kind: LifeEventKind;
  /** Primary villager the event is about. */
  subjectId: number;
  /** Secondary villagers touched (spouse, parents, heir, deceased). */
  relatedIds: number[];
  /** Plain-English diary line. */
  summary: string;
}

export type InstitutionRole =
  | 'lord'
  | 'priest'
  | 'innkeeper'
  | 'tavernkeeper'
  | 'marketmaster'
  | 'harbormaster'
  | 'wildcard';

export interface LivingVillager {
  occupantId: number;
  name: string;
  race: string;
  /** gameDay of birth (may be negative for villagers alive at sim start). */
  bornDay: number;
  /** gameDay of death; undefined while alive. */
  diedDay?: number;
  spouseId?: number;
  parentIds: number[];
  childIds: number[];
  /** Institution held (key NPCs only). */
  role?: InstitutionRole;
  homePlotId: number;
  /** Cached wealth meter (folded from events). */
  wealth: number;
}

export interface TownChronicle {
  burgId: number;
  events: LifeEvent[];
  nextEventId: number;
}

export interface TownSimState {
  burgId: number;
  /** Keyed by occupantId. Includes the dead (diedDay set) for genealogy. */
  villagers: Record<number, LivingVillager>;
  chronicle: TownChronicle;
  /** Last gameDay this state has been advanced to. */
  lastSimDay: number;
  /** Next occupant id to allocate for newborns. */
  nextVillagerId: number;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no NEW errors in `townsim/` (pre-existing vite.config.ts/dev_hub errors are known noise).

- [ ] **Step 4: Commit**

```bash
git add src/systems/worldforge/townsim/types.ts src/systems/worldforge/townsim/constants.ts
git commit -m "feat(townsim): life-event core data contracts"
```

---

## Task 2: Lifespans (lifespans.ts) — TDD

**Files:**
- Create: `src/systems/worldforge/townsim/lifespans.ts`
- Test: `src/systems/worldforge/townsim/__tests__/lifespans.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { lifespanForRace, dailyDeathProbability, childbearingWindow, DEFAULT_LIFESPAN } from '../lifespans';

describe('lifespans', () => {
  it('returns lore lifespans for known races and default for unknown', () => {
    expect(lifespanForRace('Elf').maxAge).toBeGreaterThan(500);
    expect(lifespanForRace('Human').maxAge).toBe(80);
    expect(lifespanForRace('Nonsense')).toEqual(DEFAULT_LIFESPAN);
  });

  it('death probability is tiny in youth and rises past old age', () => {
    const young = dailyDeathProbability(20, 'Human');
    const old = dailyDeathProbability(78, 'Human');
    const ancient = dailyDeathProbability(95, 'Human');
    expect(young).toBeLessThan(0.0001);
    expect(old).toBeGreaterThan(young);
    expect(ancient).toBeGreaterThan(old);
    expect(ancient).toBeLessThanOrEqual(1);
  });

  it('an elf at 78 is still in its prime (negligible death chance)', () => {
    expect(dailyDeathProbability(78, 'Elf')).toBeLessThan(0.0001);
  });

  it('childbearing window scales with race longevity', () => {
    const human = childbearingWindow('Human');
    const elf = childbearingWindow('Elf');
    expect(human.min).toBe(lifespanForRace('Human').comingOfAge);
    expect(elf.max).toBeGreaterThan(human.max);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/systems/worldforge/townsim/__tests__/lifespans.test.ts`
Expected: FAIL ("Cannot find module '../lifespans'").

- [ ] **Step 3: Write minimal implementation**

```ts
import { DAYS_PER_YEAR, BASELINE_DAILY_DEATH } from './constants';

export interface Lifespan {
  comingOfAge: number;
  maxAge: number;
}

export const RACE_LIFESPAN: Record<string, Lifespan> = {
  Human: { comingOfAge: 16, maxAge: 80 },
  Elf: { comingOfAge: 100, maxAge: 750 },
  Dwarf: { comingOfAge: 40, maxAge: 350 },
  Halfling: { comingOfAge: 20, maxAge: 150 },
  Gnome: { comingOfAge: 40, maxAge: 425 },
  'Half-Elf': { comingOfAge: 18, maxAge: 180 },
  Greenskins: { comingOfAge: 14, maxAge: 60 },
  Goliath: { comingOfAge: 16, maxAge: 90 },
  Tiefling: { comingOfAge: 16, maxAge: 96 },
  Aasimar: { comingOfAge: 16, maxAge: 160 },
  'Draconic Kin': { comingOfAge: 15, maxAge: 80 },
  Beastfolk: { comingOfAge: 14, maxAge: 70 },
};

export const DEFAULT_LIFESPAN: Lifespan = { comingOfAge: 16, maxAge: 80 };

export function lifespanForRace(race: string): Lifespan {
  return RACE_LIFESPAN[race] ?? DEFAULT_LIFESPAN;
}

/** Per-DAY death probability. Negligible until ~60% of maxAge, then ramps
 * quadratically, approaching near-certainty past maxAge. */
export function dailyDeathProbability(age: number, race: string): number {
  const { maxAge } = lifespanForRace(race);
  const rampStart = maxAge * 0.6;
  if (age < rampStart) return BASELINE_DAILY_DEATH;
  const t = Math.min(1.5, (age - rampStart) / (maxAge - rampStart)); // 0..1.5
  const annual = Math.min(0.95, 0.01 + t * t * 0.55);
  const daily = 1 - Math.pow(1 - annual, 1 / DAYS_PER_YEAR);
  return Math.max(BASELINE_DAILY_DEATH, daily);
}

/** Age window (years) in which a villager can produce children. */
export function childbearingWindow(race: string): { min: number; max: number } {
  const { comingOfAge, maxAge } = lifespanForRace(race);
  return { min: comingOfAge, max: comingOfAge + 0.4 * (maxAge - comingOfAge) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/systems/worldforge/townsim/__tests__/lifespans.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/systems/worldforge/townsim/lifespans.ts src/systems/worldforge/townsim/__tests__/lifespans.test.ts
git commit -m "feat(townsim): per-race lifespans + death/fertility curves"
```

---

## Task 3: Core sim — init + age + single-day roll (townSim.ts) — TDD

**Files:**
- Create: `src/systems/worldforge/townsim/townSim.ts`
- Test: `src/systems/worldforge/townsim/__tests__/townSim.test.ts`

**Behavior of `rollTownDay(state, day, rng)` (pure, returns new state):**
1. Deaths: for each living villager (sorted by id), draw `rng.next() < dailyDeathProbability(ageOf, race)`. On death: set `diedDay=day`, append `death` event, distribute wealth to living children equally (or spouse if no children) appending an `inheritance` event bumping heir(s) wealth meters.
2. Succession: for each death whose villager held a `role`, pick heir (eldest living child → living spouse → eldest living roleless adult), set heir.role, append `role_succession` event.
3. Births: for each unique living married couple (dedupe by `min(id,spouseId)`), both alive, both within `childbearingWindow`, `childIds.length < MAX_CHILDREN`, draw annual→daily birth chance. On birth: create newborn `LivingVillager` (new id from `nextVillagerId`, bornDay=day, race=bloodline of primary parent, parents set, added to both parents' childIds), append `birth` event.
4. Coming-of-age: any villager whose `ageOf(day) >= comingOfAge && ageOf(day-1) < comingOfAge` → append `came_of_age` event.

Deterministic: iterate sorted ids; draw rng in that order; tie-break by id.

- [ ] **Step 1: Write the failing test**

```ts
import { SeededRandom } from '../../../../utils/random/seededRandom';
import { initTownSimState, ageOf, rollTownDay, advanceTownDays } from '../townSim';
import type { TownSimState, LivingVillager } from '../types';
import { DAYS_PER_YEAR } from '../constants';

// Minimal hand-built state factory (bypasses roster for focused unit tests).
function villager(p: Partial<LivingVillager> & { occupantId: number }): LivingVillager {
  return {
    name: `V${p.occupantId}`, race: 'Human', bornDay: -30 * DAYS_PER_YEAR,
    parentIds: [], childIds: [], homePlotId: 1, wealth: 50, ...p,
  };
}
function stateOf(vs: LivingVillager[], startDay = 0): TownSimState {
  const villagers: Record<number, LivingVillager> = {};
  for (const v of vs) villagers[v.occupantId] = v;
  return {
    burgId: 1, villagers,
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

describe('rollTownDay determinism', () => {
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
    // Lord aged 95 (certain-ish death), with one adult child heir.
    const lord = villager({ occupantId: 1, bornDay: -95 * DAYS_PER_YEAR, role: 'lord', wealth: 100, childIds: [2] });
    const heir = villager({ occupantId: 2, bornDay: -30 * DAYS_PER_YEAR, parentIds: [1], wealth: 10 });
    let s = stateOf([lord, heir]);
    // Advance many days so the death is near-certain.
    s = advanceTownDays(s, 0, 400, new SeededRandom(42));
    const deadLord = s.villagers[1];
    const newHeir = s.villagers[2];
    expect(deadLord.diedDay).toBeDefined();
    expect(newHeir.role).toBe('lord');           // succession
    expect(newHeir.wealth).toBeGreaterThan(10);  // inheritance bumped meter
    const kinds = s.chronicle.events.map((e) => e.kind);
    expect(kinds).toContain('death');
    expect(kinds).toContain('role_succession');
    expect(kinds).toContain('inheritance');
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
    // newborns are registered and linked to both parents
    const child = s.villagers[births[0].subjectId];
    expect(child.parentIds.sort()).toEqual([1, 2]);
    expect(s.villagers[1].childIds).toContain(child.occupantId);
  });
});

describe('coming of age', () => {
  it('a child crossing comingOfAge emits one came_of_age event', () => {
    const kid = villager({ occupantId: 1, bornDay: -(16 * DAYS_PER_YEAR - 2) }); // turns 16 in 2 days
    let s = stateOf([kid]);
    s = advanceTownDays(s, 0, 5, new SeededRandom(1));
    const coa = s.chronicle.events.filter((e) => e.kind === 'came_of_age');
    expect(coa.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/systems/worldforge/townsim/__tests__/townSim.test.ts`
Expected: FAIL ("Cannot find module '../townSim'").

- [ ] **Step 3: Write implementation** (see townSim.ts below)

Implement `ageOf`, `initTownSimState`, `rollTownDay`, `advanceTownDays`, `villagerDiary` per the behavior spec above. Pure: deep-copy the slice you mutate (clone villagers map + chronicle events array), draw rng in sorted-id order, append events via `nextEventId`. Inheritance: split deceased.wealth equally among living children (floor), remainder to eldest; if no children, all to living spouse; bump heir wealth and emit one `inheritance` event listing recipients in `relatedIds`. Death sets `diedDay` and zeroes the deceased's wealth after distribution.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/systems/worldforge/townsim/__tests__/townSim.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/systems/worldforge/townsim/townSim.ts src/systems/worldforge/townsim/__tests__/townSim.test.ts
git commit -m "feat(townsim): day roll — aging, death, inheritance, births, succession"
```

---

## Task 4: `initTownSimState` from roster + families — TDD

**Files:**
- Modify: `src/systems/worldforge/townsim/townSim.ts` (add/confirm `initTownSimState`)
- Test: append to `townSim.test.ts`

`initTownSimState(burgId, roster, families, keyRoles, startDay)`:
- For each occupant, build `LivingVillager`: `bornDay = startDay - age*DAYS_PER_YEAR` (age from `families.get(id).age`, default 30), race from families (default 'Human'), spouseId/parentIds/childIds from `FamilyTies`, role from `keyRoles.get(id)`, wealth = `BASELINE_WEALTH`, homePlotId from occupant.
- `nextVillagerId = max(occupant ids) + 1`, `lastSimDay = startDay`, empty chronicle.

- [ ] **Step 1: Write the failing test**

```ts
import { generateTownRoster } from '../../roster/generateTownRoster';
import { assignFamilies } from '../../roster/family';
import { makeSeedPath } from '../../seedPath';
import { buildDemoTownPlan } from '../../town/demoTownPlan';

it('initTownSimState builds living villagers from a real roster', () => {
  const demo = buildDemoTownPlan(1337, { population: 200 });
  const seed = makeSeedPath(1337, 'burg:1', 's:roster');
  const roster = generateTownRoster(demo.plan, seed, { nameFor: (rng) => `Name${Math.floor(rng.next() * 1000)}` });
  const families = assignFamilies(roster.occupants, makeSeedPath(1337, 'burg:1', 's:family'));
  const s = initTownSimState(1, roster, families, new Map(), 0);
  expect(Object.keys(s.villagers).length).toBe(roster.occupants.length);
  const any = Object.values(s.villagers)[0];
  expect(any.bornDay).toBeLessThanOrEqual(0);
  expect(typeof any.race).toBe('string');
});
```

(Confirm exact `buildDemoTownPlan` / `generateTownRoster` signatures against source before running; adjust the `nameFor` shape if needed.)

- [ ] **Step 2-5:** run (fail) → implement `initTownSimState` → run (pass) → commit `feat(townsim): build sim state from roster + families`.

---

## Task 5: Chronicle summary (chronicle.ts) — TDD

**Files:**
- Create: `src/systems/worldforge/townsim/chronicle.ts`
- Test: `src/systems/worldforge/townsim/__tests__/chronicle.test.ts`

`summarizeChronicle(state, opts?)` → `string[]`, one line per year that had events:
`"Year N (days A–B): X died. Y succeeded as lord. 2 births, 1 came of age."`
`villagerDiary(state, occupantId)` → events where `subjectId===id || relatedIds.includes(id)`.

- [ ] **Step 1: Failing test** — assert a hand-built chronicle with a death+birth in year 1 yields a non-empty line containing the dead villager's name and "died"; assert `villagerDiary` filters correctly.
- [ ] **Step 2-5:** run (fail) → implement → run (pass) → commit `feat(townsim): year-grouped chronicle + per-villager diary`.

---

## Task 6: Full-decade determinism + conservation sweep — TDD

**Files:**
- Test: append to `townSim.test.ts`

- [ ] **Step 1: Write the test**

```ts
it('a 20-year run is deterministic and conserves the population ledger', () => {
  const demo = buildDemoTownPlan(2024, { population: 150 });
  const seed = makeSeedPath(2024, 'burg:1', 's:roster');
  const roster = generateTownRoster(demo.plan, seed, { nameFor: (rng) => `N${Math.floor(rng.next() * 1e6)}` });
  const families = assignFamilies(roster.occupants, makeSeedPath(2024, 'burg:1', 's:family'));
  const init = initTownSimState(1, roster, families, new Map(), 0);

  const run = (s: typeof init) => advanceTownDays(s, 0, DAYS_PER_YEAR * 20, new SeededRandom(2024));
  const a = run(init);
  const b = run(init);
  expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // determinism

  // ledger conservation: every villager is either alive or has a death event;
  // every birth event created a registered villager; no negative wealth.
  const births = a.chronicle.events.filter((e) => e.kind === 'birth').length;
  const deaths = a.chronicle.events.filter((e) => e.kind === 'death').length;
  const alive = Object.values(a.villagers).filter((v) => v.diedDay === undefined).length;
  expect(Object.keys(a.villagers).length).toBe(roster.occupants.length + births);
  expect(alive).toBe(roster.occupants.length + births - deaths);
  for (const v of Object.values(a.villagers)) expect(v.wealth).toBeGreaterThanOrEqual(0);
  // every death of a role-holder produced a succession (role never vanishes silently)
});
```

- [ ] **Step 2-5:** run → fix any conservation bugs in townSim.ts → run (pass) → commit `test(townsim): 20-year determinism + ledger conservation`.

---

## Self-Review checklist (run after Task 6)

1. **Spec coverage (life-event slice of LIVING_WORLD_SIM_SPEC):** aging ✓ (ageOf/bornDay), death ✓, role succession ✓ (D9 institution roles), births ✓, diary+meters ✓ (D7: events + cached wealth, wealth moves only via inheritance event), event-grained ✓ (D8: no per-tick numeric sim). Coming-of-age ✓ (sets up relationships layer).
2. **Placeholder scan:** none — every step has concrete code.
3. **Type consistency:** `LivingVillager`/`LifeEvent`/`TownSimState` names identical across all tasks; `rollTownDay`/`advanceTownDays`/`initTownSimState`/`ageOf`/`villagerDiary`/`summarizeChronicle` signatures stable.

---

## Subsequent plans (roadmap — separate plans, build in this order)

This plan delivers the **engine**. The remaining subsystems each get their own plan and produce working, testable software on their own:

- **Plan B — Key-NPC tagging:** at town generation, tag institution-holders (lord/priest/innkeeper/tavernkeeper/marketmaster/harbormaster) + 1–2 wildcards, scaled by `TownScaleProfile.typology`. Hook after `assignTownPopulation`/`assignWorkplaces` (proprietors) and `assignCivicRoles` (plaza/temple/keep/dock). Produces `Map<occupantId, InstitutionRole>` consumed by `initTownSimState`.
- **Plan C — Persistence + daily-loop wiring:** add `townSim` slice to `GameState` (both `initialState.ts` AND `factories.ts` — parity test!), tick the **near-ring** towns in `worldReducer` ADVANCE_TIME (new RNG offset, NOT 7777/8888/6666/9999), save/load. Path-dependent seed per D6 (incorporate a running mutation count so it's non-reproducible across routes).
- **Plan D — Distance LOD + approach catch-up:** player-relative near/far via `getTownTilesForGrid` + `atlasMilesPerUnit`; stochastic `advanceTownDays` catch-up on approach (watch player position / MOVE_PLAYER); `lastSimDay` bridges both paths (D4/D5).
- **Plan E — Festivals:** extend `CalendarSystem.HOLIDAYS` + temple-deity holy days (`templeUtils`/`DEITIES`) + per-town founding day; emit `festival` chronicle events; present-day plaza behaviour reuses existing agentSim gathering.
- **Plan F — Preview surface (play-and-eyeball, D12):** new `?phase=livingworld` preview (append `GamePhase` tail + `PHASE_SLUG_OVERRIDES`); run `advanceTownDays` over N years on a demo town, render `summarizeChronicle` + a `window.__livingWorldPreview` hook for headless proof.
- **Later layers (per §5):** economy events (good/bad years, levy, boom → wealth meter), relationships (affinity → courtship → marriage, building on `came_of_age` + `socialized`), town-scale orchestrators (fire/crime).
