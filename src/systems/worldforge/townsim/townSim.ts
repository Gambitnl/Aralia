/**
 * @file townSim.ts — Life-event core: age a town's tracked villagers forward
 * day-by-day, emitting deaths, inheritance, role succession, births, and
 * coming-of-age into an append-only chronicle (D7 diary + cached wealth meters).
 *
 * PURE & DETERMINISTIC. rollTownDay/advanceTownDays return new state and never
 * mutate inputs; all randomness comes from the caller-supplied SeededRandom,
 * drawn in a fixed (sorted-id) order so a given (state, seed) always yields the
 * same result. Production seeds the RNG path-dependently (SPEC D6); tests pin a
 * fixed seed.
 */
import { SeededRandom } from '../../../utils/random/seededRandom';
import type { TownRoster } from '../roster/types';
import type { FamilyTies } from '../roster/family';
import {
  DAYS_PER_YEAR,
  ANNUAL_BIRTH_CHANCE,
  MAX_CHILDREN,
  BASELINE_WEALTH,
} from './constants';
import { dailyDeathProbability, childbearingWindow, lifespanForRace } from './lifespans';
import type {
  InstitutionRole,
  LifeEvent,
  LifeEventKind,
  LivingVillager,
  TownChronicle,
  TownSimState,
} from './types';

/** Plain given-name pool for newborns (naming polish is a later layer). */
const NEWBORN_NAMES = [
  'Ada', 'Bryn', 'Cael', 'Dara', 'Edda', 'Finn', 'Gwen', 'Hale',
  'Isa', 'Joss', 'Kael', 'Lira', 'Maro', 'Nessa', 'Orin', 'Pell',
];

/** Integer age in years on the given gameDay. */
export function ageOf(v: LivingVillager, day: number): number {
  return Math.floor((day - v.bornDay) / DAYS_PER_YEAR);
}

const isAlive = (v: LivingVillager): boolean => v.diedDay === undefined;

/** Build a fresh sim state from a generated roster + family ties + key roles. */
export function initTownSimState(
  burgId: number,
  roster: TownRoster,
  families: Map<number, FamilyTies>,
  keyRoles: Map<number, InstitutionRole>,
  startDay: number,
): TownSimState {
  const villagers: Record<number, LivingVillager> = {};
  let maxId = 0;
  for (const occ of roster.occupants) {
    const ties = families.get(occ.id);
    const age = ties?.age ?? 30;
    villagers[occ.id] = {
      occupantId: occ.id,
      name: occ.name,
      race: ties?.race ?? 'Human',
      bornDay: startDay - age * DAYS_PER_YEAR,
      spouseId: ties?.spouseId,
      parentIds: ties ? [...ties.parentIds] : [],
      childIds: ties ? [...ties.childIds] : [],
      role: keyRoles.get(occ.id),
      homePlotId: occ.homePlotId,
      wealth: BASELINE_WEALTH,
    };
    if (occ.id > maxId) maxId = occ.id;
  }
  return {
    burgId,
    villagers,
    chronicle: { burgId, events: [], nextEventId: 1 },
    lastSimDay: startDay,
    nextVillagerId: maxId + 1,
  };
}

/** Deep-clone the mutable parts of a sim state. */
function cloneState(state: TownSimState): TownSimState {
  const villagers: Record<number, LivingVillager> = {};
  for (const id in state.villagers) {
    const v = state.villagers[id];
    villagers[id] = { ...v, parentIds: [...v.parentIds], childIds: [...v.childIds] };
  }
  return {
    ...state,
    villagers,
    chronicle: { ...state.chronicle, events: [...state.chronicle.events] },
  };
}

function addEvent(
  chronicle: TownChronicle,
  day: number,
  kind: LifeEventKind,
  subjectId: number,
  relatedIds: number[],
  summary: string,
): void {
  chronicle.events.push({ id: chronicle.nextEventId, day, kind, subjectId, relatedIds, summary });
  chronicle.nextEventId += 1;
}

/** Sorted living villager ids (numeric) for deterministic iteration. */
function livingIdsSorted(state: TownSimState): number[] {
  return Object.values(state.villagers)
    .filter(isAlive)
    .map((v) => v.occupantId)
    .sort((a, b) => a - b);
}

/** Distribute a deceased's wealth to living children (equally) or living spouse. */
function applyInheritance(state: TownSimState, deceased: LivingVillager, day: number): void {
  const amount = deceased.wealth;
  deceased.wealth = 0;
  if (amount <= 0) return;

  const livingChildren = deceased.childIds
    .map((id) => state.villagers[id])
    .filter((c) => c && isAlive(c))
    .sort((a, b) => a.bornDay - b.bornDay); // eldest first

  let recipients: LivingVillager[] = livingChildren;
  if (recipients.length === 0 && deceased.spouseId !== undefined) {
    const spouse = state.villagers[deceased.spouseId];
    if (spouse && isAlive(spouse)) recipients = [spouse];
  }
  if (recipients.length === 0) return; // wealth lost (no heirs)

  const share = Math.floor(amount / recipients.length);
  let remainder = amount - share * recipients.length;
  for (const r of recipients) {
    r.wealth += share;
    if (remainder > 0) {
      r.wealth += 1; // remainder to eldest first
      remainder -= 1;
    }
  }
  addEvent(
    state.chronicle,
    day,
    'inheritance',
    recipients[0].occupantId,
    [deceased.occupantId, ...recipients.map((r) => r.occupantId)],
    `${recipients.map((r) => r.name).join(', ')} inherited ${amount} from ${deceased.name}.`,
  );
}

/** Find an heir for a vacated role and install them. */
function applySuccession(state: TownSimState, deceased: LivingVillager, day: number): void {
  const role = deceased.role;
  if (!role) return;
  deceased.role = undefined;

  // Only ROLELESS villagers may inherit a role: installing someone who already
  // holds an institution would overwrite (and silently destroy) that other
  // institution, since a villager holds at most one role.
  const livingChildren = deceased.childIds
    .map((id) => state.villagers[id])
    .filter((c) => c && isAlive(c) && !c.role)
    .sort((a, b) => a.bornDay - b.bornDay); // eldest first

  let heir: LivingVillager | undefined = livingChildren.find(
    (c) => ageOf(c, day) >= lifespanForRace(c.race).comingOfAge,
  );

  if (!heir && deceased.spouseId !== undefined) {
    const spouse = state.villagers[deceased.spouseId];
    if (spouse && isAlive(spouse) && !spouse.role) heir = spouse;
  }

  if (!heir) {
    // Eldest roleless adult first, then any roleless villager (regency). If
    // every survivor already holds a role, the role LAPSES rather than
    // cannibalizing another institution — institutions are preserved.
    const roleless = Object.values(state.villagers)
      .filter((v) => isAlive(v) && v.occupantId !== deceased.occupantId && !v.role)
      .sort((a, b) => a.bornDay - b.bornDay);
    heir =
      roleless.find((v) => ageOf(v, day) >= lifespanForRace(v.race).comingOfAge) ??
      roleless[0];
  }

  if (!heir) return; // no roleless survivor — role lapses (institutions preserved)
  heir.role = role;
  addEvent(
    state.chronicle,
    day,
    'role_succession',
    heir.occupantId,
    [deceased.occupantId],
    `${heir.name} succeeded ${deceased.name} as ${role}.`,
  );
}

/** Annual probability → daily probability. */
function annualToDaily(annual: number): number {
  return 1 - Math.pow(1 - annual, 1 / DAYS_PER_YEAR);
}

/** Advance one day; returns a new state (input untouched). */
export function rollTownDay(state: TownSimState, day: number, rng: SeededRandom): TownSimState {
  const next = cloneState(state);

  // Snapshot the cohort that existed at the start of the day (newborns added
  // later this day are not aged/killed on their birth day).
  const cohort = livingIdsSorted(next);

  // 1. Deaths (+ inheritance + succession), in id order.
  for (const id of cohort) {
    const v = next.villagers[id];
    if (!isAlive(v)) continue;
    const p = dailyDeathProbability(ageOf(v, day), v.race);
    if (rng.next() < p) {
      v.diedDay = day;
      addEvent(next.chronicle, day, 'death', v.occupantId, [], `${v.name} died at age ${ageOf(v, day)}.`);
      applyInheritance(next, v, day);
      applySuccession(next, v, day);
    }
  }

  // 2. Births to living married couples (process once per couple, lower id leads).
  for (const id of cohort) {
    const v = next.villagers[id];
    if (!isAlive(v) || v.spouseId === undefined || v.spouseId < v.occupantId) continue;
    const spouse = next.villagers[v.spouseId];
    if (!spouse || !isAlive(spouse)) continue;
    if (v.childIds.length >= MAX_CHILDREN) continue;

    const wv = childbearingWindow(v.race);
    const ws = childbearingWindow(spouse.race);
    const av = ageOf(v, day);
    const as = ageOf(spouse, day);
    const fertile = av >= wv.min && av <= wv.max && as >= ws.min && as <= ws.max;
    if (!fertile) continue;

    if (rng.next() < annualToDaily(ANNUAL_BIRTH_CHANCE)) {
      const childId = next.nextVillagerId;
      next.nextVillagerId += 1;
      // bloodline: lower-id parent's race (matches family.ts head-of-household rule)
      const bloodline = v.occupantId < spouse.occupantId ? v.race : spouse.race;
      const childName = rng.pick(NEWBORN_NAMES);
      const newborn: LivingVillager = {
        occupantId: childId,
        name: childName,
        race: bloodline,
        bornDay: day,
        parentIds: [v.occupantId, spouse.occupantId].sort((a, b) => a - b),
        childIds: [],
        homePlotId: v.homePlotId,
        wealth: 0,
      };
      next.villagers[childId] = newborn;
      v.childIds.push(childId);
      spouse.childIds.push(childId);
      addEvent(
        next.chronicle,
        day,
        'birth',
        childId,
        [v.occupantId, spouse.occupantId],
        `${childName} was born to ${v.name} and ${spouse.name}.`,
      );
    }
  }

  // 3. Coming of age (cohort only; no rng).
  for (const id of cohort) {
    const v = next.villagers[id];
    if (!isAlive(v)) continue;
    const coa = lifespanForRace(v.race).comingOfAge;
    if (ageOf(v, day) >= coa && ageOf(v, day - 1) < coa) {
      addEvent(next.chronicle, day, 'came_of_age', v.occupantId, [], `${v.name} came of age.`);
    }
  }

  next.lastSimDay = day;
  return next;
}

/**
 * Advance the sim from its current lastSimDay up to and including `toDay`.
 * `fromDay` is informational; the loop is anchored on state.lastSimDay so a
 * single RNG stream rolls each intervening day in order (deterministic).
 */
export function advanceTownDays(
  state: TownSimState,
  _fromDay: number,
  toDay: number,
  rng: SeededRandom,
): TownSimState {
  let s = state;
  for (let day = state.lastSimDay + 1; day <= toDay; day++) {
    s = rollTownDay(s, day, rng);
  }
  return s;
}

/** All events touching a villager (as subject or related) — their personal diary. */
export function villagerDiary(state: TownSimState, occupantId: number): LifeEvent[] {
  return state.chronicle.events.filter(
    (e) => e.subjectId === occupantId || e.relatedIds.includes(occupantId),
  );
}
