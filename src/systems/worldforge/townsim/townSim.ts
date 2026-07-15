// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 14/07/2026, 18:51:02
 * Dependents: components/Worldforge/LivingWorldPreview.tsx, components/debug/TownHistoryDevOverlay.tsx, systems/worldforge/townsim/townSimRegistration.ts, systems/worldforge/townsim/townSimRegistry.ts
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file townSim.ts — Life-event core: age a town's tracked villagers forward
 * day-by-day, emitting personal and town events plus exact saved changes on
 * occupied homes into an append-only chronicle (D7 diary + cached meters).
 *
 * PURE & DETERMINISTIC. rollTownDay/advanceTownDays return new state and never
 * mutate inputs; all randomness comes from the caller-supplied SeededRandom,
 * drawn in a fixed (sorted-id) order so a given (state, seed) always yields the
 * same result. Production seeds the RNG path-dependently (SPEC D6); tests pin a
 * fixed seed. Building evolution uses named hashes and prevalidated geometry,
 * so it does not consume or shift the established simulation draws.
 */
import { SeededRandom } from '../../../utils/random/seededRandom';
import type { TownRoster } from '../roster/types';
import type { FamilyTies } from '../roster/family';
import {
  DAYS_PER_YEAR,
  ANNUAL_BIRTH_CHANCE,
  ANNUAL_COURTSHIP_CHANCE,
  COURTSHIP_DAYS,
  MAX_CHILDREN,
  BASELINE_WEALTH,
} from './constants';
import {
  dailyDeathProbability,
  childbearingWindow,
  marriageableWindow,
  lifespanForRace,
} from './lifespans';
import { rollAnnualEconomy, type EconomyKind } from './economy';
import {
  rollAnnualDisaster,
  disasterSummary,
  fireDeaths,
  plagueDeaths,
  crimeWaveWealthLoss,
} from './disasters';
import { festivalsOnDayOfYear } from './festivals';
import { newbornName } from './naming';
import { fnv1a, makeSeedPath, seedFromPath } from '../seedPath';
import {
  appendBuildingEvent,
  buildingUseStateSince,
  cloneBuildingEventHistory,
  currentBuildingUse,
  hasUnrepairedBuildingFire,
  structuralBuildingHistoryEvents,
} from '../interior/buildingEventHistory';
import type { BuildingEvent } from '../interior/blueprintTypes';
import type {
  InstitutionRole,
  LifeEvent,
  LifeEventKind,
  LivingVillager,
  TownChronicle,
  TownSimState,
} from './types';

/** Integer age in years on the given gameDay. */
export function ageOf(v: LivingVillager, day: number): number {
  return Math.floor((day - v.bornDay) / DAYS_PER_YEAR);
}

const isAlive = (v: LivingVillager): boolean => v.diedDay === undefined;

/** True if a and b are parent/child or siblings — never allowed to marry. */
function isCloseKin(a: LivingVillager, b: LivingVillager): boolean {
  if (a.parentIds.includes(b.occupantId) || a.childIds.includes(b.occupantId)) return true;
  return a.parentIds.some((p) => b.parentIds.includes(p)); // shared parent → siblings
}

/** Marriageable: alive, unwed, not currently courting, within the age window. */
function isSingleMarriageable(v: LivingVillager, day: number): boolean {
  if (!isAlive(v) || v.spouseId !== undefined || v.courtingId !== undefined) return false;
  const w = marriageableWindow(v.race);
  const age = ageOf(v, day);
  return age >= w.min && age <= w.max;
}

/** Build a fresh sim state from a generated roster + family ties + key roles. */
export function initTownSimState(
  burgId: number,
  roster: TownRoster,
  families: Map<number, FamilyTies>,
  keyRoles: Map<number, InstitutionRole>,
  startDay: number,
  buildingEvolution?: TownSimState['buildingEvolution'],
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
    buildingEvents: {},
    ...(buildingEvolution ? { buildingEvolution } : {}),
    prosperity: 50,
    totals: { births: 0, deaths: 0 },
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
  const buildingEvents = Object.fromEntries(
    Object.entries(state.buildingEvents ?? {}).map(([plotId, events]) => [
      Number(plotId),
      cloneBuildingEventHistory(events),
    ]),
  );
  return {
    ...state,
    villagers,
    chronicle: { ...state.chronicle, events: [...state.chronicle.events] },
    buildingEvents,
    // Evolution briefs are immutable registration metadata. Reuse the same
    // reference across daily states; only event logs and villagers are mutable.
    totals: { ...(state.totals ?? { births: 0, deaths: 0 }) },
  };
}

/** Rank plots with a named hash so this channel never consumes life-event RNG. */
function rankEvolutionPlots(state: TownSimState, day: number, plotIds: number[]): number[] {
  return plotIds.slice().sort((a, b) =>
    fnv1a(`burg:${state.burgId}:day:${day}:building:${a}`)
      - fnv1a(`burg:${state.burgId}:day:${day}:building:${b}`)
      || a - b);
}

// ============================================================================
// Household Moves And Building Use
// ============================================================================
// A home's current use comes from the same event log the renderers replay.
// Villagers keep their exact home ids after death, so old saves already contain
// enough evidence to discover empty dwellings without a parallel property list.
// ============================================================================

/** Include historic and logged homes so pruning cannot erase a known residence. */
function knownHomePlots(state: TownSimState): number[] {
  const plots = new Set<number>();
  for (const villager of Object.values(state.villagers)) plots.add(villager.homePlotId);
  for (const plotId of Object.keys(state.buildingEvents ?? {})) plots.add(Number(plotId));
  return [...plots].sort((a, b) => a - b);
}

/** Collect current residents by plot for vacancy and household decisions. */
function livingResidentsByPlot(state: TownSimState): Map<number, LivingVillager[]> {
  const residentsByPlot = new Map<number, LivingVillager[]>();
  for (const villager of Object.values(state.villagers)) {
    if (!isAlive(villager)) continue;
    const residents = residentsByPlot.get(villager.homePlotId) ?? [];
    residents.push(villager);
    residentsByPlot.set(villager.homePlotId, residents);
  }
  return residentsByPlot;
}

/**
 * Give a newly married couple one shared home. They prefer a sound abandoned
 * dwelling, bringing dependent children with them; otherwise one spouse joins
 * the other household. The named hash varies that choice without another RNG.
 */
function establishMarriedHousehold(
  state: TownSimState,
  day: number,
  first: LivingVillager,
  second: LivingVillager,
): void {
  if (first.homePlotId === second.homePlotId) return;
  const residentsByPlot = livingResidentsByPlot(state);
  const vacant = knownHomePlots(state).filter((plotId) =>
    !residentsByPlot.has(plotId)
    && currentBuildingUse(state.buildingEvents?.[plotId] ?? []) === 'abandoned'
    && !hasUnrepairedBuildingFire(state.buildingEvents?.[plotId] ?? []));
  const reusable = rankEvolutionPlots(state, day, vacant)[0];
  const existingHomes = [first.homePlotId, second.homePlotId];
  const targetPlotId = reusable ?? existingHomes[
    fnv1a(`burg:${state.burgId}:day:${day}:marriage:${first.occupantId}:${second.occupantId}:home`) % 2
  ];

  // Keep both source properties discoverable after their last living resident
  // moves. An empty sparse log is enough for reconciliation to board a vacated
  // home later this same day, and it avoids a second property registry.
  state.buildingEvents ??= {};
  for (const plotId of existingHomes) state.buildingEvents[plotId] ??= [];

  const movers = new Set<number>([first.occupantId, second.occupantId]);
  for (const parent of [first, second]) {
    for (const childId of parent.childIds) {
      const child = state.villagers[childId];
      if (!child || !isAlive(child) || child.homePlotId !== parent.homePlotId) continue;
      if (ageOf(child, day) < lifespanForRace(child.race).comingOfAge) movers.add(childId);
    }
  }
  for (const occupantId of movers) state.villagers[occupantId].homePlotId = targetPlotId;
}

/**
 * Make persisted use state agree with actual residents. This also migrates old
 * saves: a dead-only historic home receives its first abandonment event on the
 * next simulated day, while an occupied abandoned home is re-opened.
 */
function reconcileBuildingUse(state: TownSimState, day: number): void {
  const residentsByPlot = livingResidentsByPlot(state);
  for (const plotId of knownHomePlots(state)) {
    const residents = residentsByPlot.get(plotId) ?? [];
    const currentUse = currentBuildingUse(state.buildingEvents?.[plotId] ?? []);
    if (residents.length === 0 && currentUse === 'occupied') {
      const boardedFraction = 0.45
        + (fnv1a(`burg:${state.burgId}:plot:${plotId}:abandonment:${day}`) % 31) / 100;
      const event: BuildingEvent = {
        day,
        kind: 'abandonment',
        payload: { reason: 'household vacancy', boardedFraction },
      };
      state.buildingEvents ??= {};
      state.buildingEvents[plotId] = appendBuildingEvent(state.buildingEvents[plotId], event);
      addEvent(
        state.chronicle,
        day,
        'building',
        0,
        [],
        `The household on plot ${plotId} stood empty and was boarded up.`,
      );
    } else if (residents.length > 0 && currentUse === 'abandoned') {
      const event: BuildingEvent = {
        day,
        kind: 'reoccupation',
        payload: { occupantId: String(residents[0].occupantId) },
      };
      state.buildingEvents ??= {};
      state.buildingEvents[plotId] = appendBuildingEvent(state.buildingEvents[plotId], event);
      addEvent(
        state.chronicle,
        day,
        'building',
        residents[0].occupantId,
        residents.slice(1).map((resident) => resident.occupantId),
        `A household brought the abandoned home on plot ${plotId} back into use.`,
      );
    }
  }
}

/**
 * Long vacancy has a building-specific lifespan of eight to twenty years.
 * Once that deterministic threshold passes, neglect becomes a real ruin event
 * with stable severity rather than a random renderer decoration.
 */
function recordNeglectRuins(state: TownSimState, day: number): void {
  if (day <= 0 || day % DAYS_PER_YEAR !== 0) return;
  for (const plotId of knownHomePlots(state)) {
    const events = state.buildingEvents?.[plotId] ?? [];
    const useState = buildingUseStateSince(events);
    if (useState.status !== 'abandoned' || useState.sinceDay === null) continue;
    const vacantYears = 8 + (fnv1a(`burg:${state.burgId}:plot:${plotId}:neglect-years`) % 13);
    if (day - useState.sinceDay < vacantYears * DAYS_PER_YEAR) continue;
    const severity = (1 + (fnv1a(`burg:${state.burgId}:plot:${plotId}:neglect-severity`) % 3)) as 1 | 2 | 3;
    const event: BuildingEvent = {
      day,
      kind: 'ruin',
      payload: { cause: 'neglect', severity },
    };
    state.buildingEvents ??= {};
    state.buildingEvents[plotId] = appendBuildingEvent(events, event);
    addEvent(
      state.chronicle,
      day,
      'building',
      0,
      [],
      `The long-abandoned home on plot ${plotId} fell into neglectful ruin.`,
    );
  }
}

/**
 * Turn a prosperous year into one visible, persisted building change. Repairs
 * take precedence over growth; otherwise one occupied home consumes its next
 * prevalidated district-aware extension candidate.
 */
function recordProsperityBuildingChange(
  state: TownSimState,
  day: number,
  economyKind: EconomyKind,
): void {
  if (economyKind !== 'good_year' && economyKind !== 'boom') return;
  if ((state.prosperity ?? 50) < 55) return;

  const residentsByPlot = new Map<number, LivingVillager[]>();
  for (const villager of Object.values(state.villagers)) {
    if (!isAlive(villager)) continue;
    const residents = residentsByPlot.get(villager.homePlotId) ?? [];
    residents.push(villager);
    residentsByPlot.set(villager.homePlotId, residents);
  }
  const occupiedPlots = [...residentsByPlot.keys()];
  const damaged = rankEvolutionPlots(state, day, occupiedPlots.filter((plotId) =>
    hasUnrepairedBuildingFire(state.buildingEvents?.[plotId] ?? [])));
  const repairPlot = damaged[0];
  if (repairPlot !== undefined) {
    const event: BuildingEvent = { day, kind: 'renovation', payload: { scope: 'repair' } };
    state.buildingEvents ??= {};
    state.buildingEvents[repairPlot] = appendBuildingEvent(state.buildingEvents[repairPlot], event);
    const residents = residentsByPlot.get(repairPlot) ?? [];
    addEvent(
      state.chronicle,
      day,
      'building',
      residents[0]?.occupantId ?? 0,
      residents.slice(1).map((resident) => resident.occupantId),
      `Prosperity funded repairs to the household on plot ${repairPlot}.`,
    );
    return;
  }

  const extensible = rankEvolutionPlots(state, day, occupiedPlots.filter((plotId) => {
    const brief = state.buildingEvolution?.[plotId];
    if (!brief) return false;
    const used = structuralBuildingHistoryEvents(
      state.buildingEvents?.[plotId] ?? [],
    ).length;
    return used < brief.extensionCandidates.length;
  }));
  const plotId = extensible[0];
  if (plotId === undefined) return;
  const brief = state.buildingEvolution![plotId];
  const used = structuralBuildingHistoryEvents(
    state.buildingEvents?.[plotId] ?? [],
  ).length;
  const candidate = brief.extensionCandidates[used];
  const event: BuildingEvent = {
    day,
    kind: 'extension',
    payload: { phase: candidate.phase, mass: { ...candidate.mass } },
  };
  state.buildingEvents ??= {};
  state.buildingEvents[plotId] = appendBuildingEvent(state.buildingEvents[plotId], event);
  const residents = residentsByPlot.get(plotId) ?? [];
  addEvent(
    state.chronicle,
    day,
    'building',
    residents[0]?.occupantId ?? 0,
    residents.slice(1).map((resident) => resident.occupantId),
    `A ${candidate.roofForm}-roofed ${candidate.mass.kind} expanded the household on plot ${plotId}.`,
  );
}

/**
 * Record one town fire against an exact canonical plot without consuming the
 * life-event RNG. Severity is a named hash of stable incident identity, so this
 * added persistence channel cannot reroll deaths, births, or economy outcomes.
 */
function recordFireDamage(state: TownSimState, day: number, plotId: number): void {
  const incidentId = `burg:${state.burgId}:day:${day}:fire`;
  const severity = (2 + (fnv1a(`${incidentId}:plot:${plotId}:severity`) % 2)) as 2 | 3;
  const event: BuildingEvent = {
    day,
    kind: 'fire-damage',
    payload: { incidentId, severity },
  };
  state.buildingEvents ??= {};
  state.buildingEvents[plotId] = appendBuildingEvent(
    state.buildingEvents[plotId],
    event,
  );
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

/**
 * Kill a villager and run all the bookkeeping a death entails: stamp diedDay,
 * write the 'death' chronicle line, then distribute the estate and succeed any
 * institution. Shared by natural deaths AND town-scale disasters so a disaster
 * death is indistinguishable from a natural one (population conservation holds
 * and institutions never silently vanish). Mutates `state` in place.
 */
function killVillager(state: TownSimState, v: LivingVillager, day: number, summary: string): void {
  v.diedDay = day;
  if (state.totals) state.totals.deaths += 1;
  addEvent(state.chronicle, day, 'death', v.occupantId, [], summary);
  applyInheritance(state, v, day);
  applySuccession(state, v, day);
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

// ── Raid-worry (Pillar 2, Task 8) ────────────────────────────────────────────
//
// Optional per-day input: the raid PRESSURE the burg feels from the uncleared
// dungeons around it (0..1, from raidPressureForBurg). Above a threshold, the
// town's daily roll OCCASIONALLY writes one "raid-worry" chronicle line — a mood
// symptom of the ecology signal, never a death. The roll draws on its OWN seed
// stream (per burg + day), NOT the passed `rng`, so every existing life-event
// draw order — and every existing townSim test — is byte-for-byte unchanged.

/** Below this pressure the burg is calm enough that no worry line is ever rolled. */
const RAID_WORRY_MIN_PRESSURE = 0.35;
/** Peak daily chance of a worry line, reached at full pressure. Scaled by
 * pressure so a mildly threatened town frets rarely, a besieged one often. */
const RAID_WORRY_MAX_DAILY_CHANCE = 0.12;

/** Laconic worry lines (same tone bar as the rumor hooks). Chosen deterministically
 * by the worry stream so the same (burg, day) always reads the same line. */
const RAID_WORRY_LINES: ReadonlyArray<string> = [
  "Herders won't graze past the tree line — not since something took a heifer.",
  'Folk are barring their doors early. Word is something out of the old dark is on the move.',
  "The road wardens want more hands. They won't say against what, only that it comes by night.",
  'Nobody rides the outer track alone anymore. Whatever dens out there is getting bold.',
];

export interface RollTownDayOptions {
  /** World seed — seeds the raid-worry stream (kept off the life-event rng). */
  worldSeed?: number;
  /** Raid pressure (0..1) the burg feels from uncleared dungeons today. */
  raidPressure?: number;
}

/** Advance one day; returns a new state (input untouched). `opts` carries the
 * optional raid-pressure signal (Task 8); omitting it reproduces the pre-Task-8
 * behavior exactly (no worry line, no extra draws on any stream). */
export function rollTownDay(
  state: TownSimState,
  day: number,
  rng: SeededRandom,
  opts?: RollTownDayOptions,
): TownSimState {
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
      killVillager(next, v, day, `${v.name} died at age ${ageOf(v, day)}.`);
    }
  }

  // 1b. Resolve courtships: a matured courtship becomes a marriage; a courtship
  // whose partner died (or no longer points back) simply ends. No rng.
  for (const id of cohort) {
    const v = next.villagers[id];
    if (!isAlive(v) || v.courtingId === undefined) continue;
    const partner = next.villagers[v.courtingId];
    if (!partner || !isAlive(partner) || partner.courtingId !== v.occupantId) {
      v.courtingId = undefined;
      v.courtshipStartDay = undefined;
      continue;
    }
    if (v.occupantId > partner.occupantId) continue; // process the pair once
    if (v.spouseId !== undefined || partner.spouseId !== undefined) continue;
    if (day - (v.courtshipStartDay ?? day) < COURTSHIP_DAYS) continue;
    v.spouseId = partner.occupantId;
    partner.spouseId = v.occupantId;
    v.courtingId = undefined;
    v.courtshipStartDay = undefined;
    partner.courtingId = undefined;
    partner.courtshipStartDay = undefined;
    // Marriage creates one real household. Reusing an abandoned home gives
    // vacancy and reoccupation a demographic cause instead of a cosmetic roll.
    establishMarriedHousehold(next, day, v, partner);
    addEvent(next.chronicle, day, 'marriage', v.occupantId, [partner.occupantId], `${v.name} married ${partner.name}.`);
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
      // bloodline: lower-id parent's race (matches family.ts head-of-household rule).
      // v is the lower-id parent (the couple is processed once, led by lower id),
      // so the child inherits v's race AND family surname.
      const bloodline = v.occupantId < spouse.occupantId ? v.race : spouse.race;
      const childName = newbornName(rng, bloodline, v.name);
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
      if (next.totals) next.totals.births += 1;
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

  // 4. Form new courtships among eligible singles (affinity abstracted into the
  // courtship chance + the courtship period). rng drawn in sorted-id order;
  // partners chosen deterministically by closest age (tie-break: lower id).
  const singles = cohort
    .map((id) => next.villagers[id])
    .filter((v) => isSingleMarriageable(v, day))
    .sort((a, b) => a.occupantId - b.occupantId);
  const pairedToday = new Set<number>();
  const dailyCourtship = annualToDaily(ANNUAL_COURTSHIP_CHANCE);
  for (const a of singles) {
    if (pairedToday.has(a.occupantId)) continue;
    if (rng.next() >= dailyCourtship) continue;
    const ageA = ageOf(a, day);
    let best: LivingVillager | undefined;
    let bestGap = Infinity;
    for (const b of singles) {
      if (b.occupantId === a.occupantId || pairedToday.has(b.occupantId)) continue;
      if (isCloseKin(a, b)) continue;
      const gap = Math.abs(ageOf(b, day) - ageA);
      if (gap < bestGap || (gap === bestGap && best !== undefined && b.occupantId < best.occupantId)) {
        best = b;
        bestGap = gap;
      }
    }
    if (!best) continue;
    a.courtingId = best.occupantId;
    a.courtshipStartDay = day;
    best.courtingId = a.occupantId;
    best.courtshipStartDay = day;
    pairedToday.add(a.occupantId);
    pairedToday.add(best.occupantId);
    addEvent(next.chronicle, day, 'courtship', a.occupantId, [best.occupantId], `${a.name} and ${best.name} began courting.`);
  }

  // 5. Annual economy (event-grained): once per game year, a town-wide outcome
  // (good/lean year, levy, boom) shifts every living villager's wealth meter and
  // the town prosperity meter, and writes one chronicle line. subjectId 0 marks
  // a town-level event (not a personal diary entry).
  if (day > 0 && day % DAYS_PER_YEAR === 0) {
    const outcome = rollAnnualEconomy(rng);
    if (outcome.kind !== 'steady') {
      for (const id of Object.keys(next.villagers)) {
        const v = next.villagers[Number(id)];
        if (!isAlive(v)) continue;
        v.wealth = Math.max(0, v.wealth + outcome.wealthDelta);
      }
      const base = next.prosperity ?? 50;
      next.prosperity = Math.max(0, Math.min(100, base + outcome.prosperityDelta));
      addEvent(next.chronicle, day, 'economy', 0, [], outcome.summary);
      // Building evolution follows the updated prosperity meter but uses named
      // hashes and stored geometry, preserving every existing RNG draw.
      recordProsperityBuildingChange(next, day, outcome.kind);
    }

    // 5b. Annual disaster (rare + dramatic): after the economy pass so its rng
    // draw order is unchanged. One town-level 'disaster' announcement, then the
    // kind's bounded consequences. fire/plague kill distinct living villagers
    // via killVillager (so each emits a 'death' + inheritance + succession,
    // exactly like a natural death); crime_wave drains wealth only. Victims are
    // picked deterministically: from the sorted living-id pool, draw a
    // MAX-EXCLUSIVE index and splice it out, never exceeding the living count.
    const disaster = rollAnnualDisaster(rng);
    if (disaster) {
      addEvent(next.chronicle, day, 'disaster', 0, [], disasterSummary(disaster.kind));
      if (disaster.kind === 'crime_wave') {
        const loss = crimeWaveWealthLoss();
        for (const id of livingIdsSorted(next)) {
          const v = next.villagers[id];
          v.wealth = Math.max(0, v.wealth + loss);
        }
        const base = next.prosperity ?? 50;
        next.prosperity = Math.max(0, Math.min(100, base - 3));
      } else {
        const pool = livingIdsSorted(next);
        const want = disaster.kind === 'fire' ? fireDeaths(pool.length) : plagueDeaths(pool.length);
        const toKill = Math.min(want, pool.length);
        const firePlots = new Set<number>();
        for (let k = 0; k < toKill; k++) {
          const pick = rng.nextInt(0, pool.length); // MAX-EXCLUSIVE
          const victimId = pool[pick];
          pool.splice(pick, 1);
          const victim = next.villagers[victimId];
          if (disaster.kind === 'fire') firePlots.add(victim.homePlotId);
          killVillager(next, victim, day, `${victim.name} died in the ${disaster.kind}.`);
        }
        // One building event per affected household, even when several victims
        // shared a home. Sort plot ids so object insertion order is replay-stable.
        if (disaster.kind === 'fire') {
          for (const plotId of [...firePlots].sort((a, b) => a - b)) {
            recordFireDamage(next, day, plotId);
          }
        }
      }
    }
  }

  // 6. Festivals (calendar-deterministic; no rng). Any festival whose fixed
  // day-of-year matches today is held: shared seasonal feasts plus this burg's
  // Founding Day and Patron's Feast. Each writes one town-level chronicle line
  // (subjectId 0, matching the economy convention) and nudges prosperity +1
  // (clamped 0..100). Drawing no randomness keeps every other pass's RNG stream
  // — and the existing tests — unperturbed.
  const dayOfYear = ((day % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
  for (const name of festivalsOnDayOfYear(dayOfYear, next.burgId)) {
    const base = next.prosperity ?? 50;
    next.prosperity = Math.max(0, Math.min(100, base + 1));
    addEvent(next.chronicle, day, 'festival', 0, [], `The town held ${name}.`);
  }

  // 7. Raid-worry (Task 8): the ecology signal's one visible symptom. Above the
  // pressure floor, an occasional worry line joins the chronicle. Rolled on a
  // SEPARATE per-(burg, day) stream — NEVER the life-event `rng` — so it cannot
  // shift any existing draw and leaves every pre-Task-8 test byte-identical.
  const pressure = opts?.raidPressure ?? 0;
  if (pressure >= RAID_WORRY_MIN_PRESSURE) {
    const worryRng = new SeededRandom(
      seedFromPath(makeSeedPath(opts?.worldSeed ?? 0, `burg:${next.burgId}`, `day:${day}`, 's:raidworry')),
    );
    const chance = RAID_WORRY_MAX_DAILY_CHANCE * pressure;
    if (worryRng.next() < chance) {
      const line = RAID_WORRY_LINES[worryRng.nextInt(0, RAID_WORRY_LINES.length)]; // MAX-EXCLUSIVE
      addEvent(next.chronicle, day, 'raid_worry', 0, [], line);
    }
  }

  // Occupancy reconciliation runs after every cause of death, birth, and move.
  // Annual neglect then sees the final use state for this day.
  reconcileBuildingUse(next, day);
  recordNeglectRuins(next, day);

  next.lastSimDay = day;
  return next;
}

/**
 * Advance the sim from its current lastSimDay up to and including `toDay`,
 * threading ONE caller-supplied RNG across the whole span.
 *
 * TEST-ONLY. Because it uses a single RNG stream, its result is chunking-
 * DEPENDENT (advancing 0→100 in one call ≠ 0→50 then 50→100). Production must
 * use {@link advanceTown}/advanceRegistry instead, which re-seed per
 * (worldSeed, burgId, day) and are therefore chunking-INDEPENDENT. This helper
 * exists only to exercise rollTownDay's per-day logic under a fixed seed in unit
 * tests; do not wire it into the real game.
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
