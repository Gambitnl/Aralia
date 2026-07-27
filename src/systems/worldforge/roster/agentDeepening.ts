// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 20:18:41
 * Dependents: systems/worldforge/roster/agentLife.ts
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file deepens the deterministic multi-day agent simulation with a small
 * daily economy, relationships earned through repeated contact, and town-wide
 * events.
 *
 * It extends the canonical TownSimState produced by the life-event spine. The
 * same villagers and chronicle still own births, deaths, marriages, wealth,
 * and genealogy; this layer only adds bounded market, bond, and weather facts.
 * Every random channel is named by town and day, so resuming a save or replaying
 * the same span in different chunks produces the same result and event order.
 *
 * Called by: agentLife.ts when callers select the optional `deepened` mode.
 * Depends on: existing townsim economy, festival, disaster, and seed contracts.
 */
import { SeededRandom } from '../../../utils/random/seededRandom';
import { fnv1a, makeSeedPath, seedFromPath } from '../seedPath';
import { COURTSHIP_DAYS, DAYS_PER_YEAR, RETENTION_YEARS } from '../townsim/constants';
import { disasterSummary } from '../townsim/disasters';
import { rollAnnualEconomy } from '../townsim/economy';
import { festivalsOnDayOfYear } from '../townsim/festivals';
import type {
  AgentDeepeningState,
  AgentRelationshipBond,
  LifeEventKind,
  LivingVillager,
  TownSimState,
} from '../townsim/types';
import type { Occupant, TownRoster } from './types';

// ============================================================================
// Bounded-State Tunings
// ============================================================================
// Wealth and rolling shop takings are deliberately capped. The chronicle keeps
// the existing retention window while its next id remains monotonic, and social
// bonds are limited to four per living villager after inactive pairs expire.
// These bounds make century-scale replay safe without changing its outcome.
// ============================================================================

const MAX_WEALTH = 1_000;
const MAX_SHOP_INCOME = 100_000;
const MAX_CONTACT_DAYS = 10_000;
const BOND_IDLE_RETENTION_DAYS = 180;
const MAX_BONDS_PER_LIVING_VILLAGER = 4;
const CHRONICLE_RETENTION_DAYS = RETENTION_YEARS * DAYS_PER_YEAR;
const TOWN_EVENT_INTERVAL_DAYS = 30;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));

/** A chronicle append preserves the town-wide monotonic id contract. */
function addEvent(
  state: TownSimState,
  day: number,
  kind: LifeEventKind,
  subjectId: number,
  relatedIds: number[],
  summary: string,
): void {
  state.chronicle.events.push({
    id: state.chronicle.nextEventId,
    day,
    kind,
    subjectId,
    relatedIds,
    summary,
  });
  state.chronicle.nextEventId += 1;
}

/** Copy every mutable record this layer can change, leaving inputs untouched. */
function cloneForDeepening(state: TownSimState): TownSimState {
  const villagers = Object.fromEntries(
    Object.entries(state.villagers).map(([id, villager]) => [
      Number(id),
      {
        ...villager,
        parentIds: [...villager.parentIds],
        childIds: [...villager.childIds],
      },
    ]),
  );
  const existing = state.agentDeepening;

  return {
    ...state,
    villagers,
    chronicle: { ...state.chronicle, events: [...state.chronicle.events] },
    agentDeepening: existing
      ? {
          economy: {
            ...existing.economy,
            shopIncomeByPlot: { ...existing.economy.shopIncomeByPlot },
            districtWealthByHomePlot: { ...existing.economy.districtWealthByHomePlot },
          },
          relationships: Object.fromEntries(
            Object.entries(existing.relationships).map(([key, bond]) => [key, { ...bond }]),
          ),
          townEvents: { ...existing.townEvents },
        }
      : undefined,
  };
}

/** Create the optional payload from stable defaults when an old save first opts in. */
function initializeDeepening(day: number): AgentDeepeningState {
  return {
    economy: {
      priceIndex: 100,
      shopIncomeByPlot: {},
      districtWealthByHomePlot: {},
      lastUpdatedDay: day - 1,
    },
    relationships: {},
    townEvents: { weather: 'mild', lastUpdatedDay: day - 1 },
  };
}

/** A living check remains local so townsim's private death bookkeeping stays authoritative. */
function isAlive(villager: LivingVillager | undefined): villager is LivingVillager {
  return villager !== undefined && villager.diedDay === undefined;
}

/** Exact age is only needed to prevent children and elders entering courtship. */
function ageOnDay(villager: LivingVillager, day: number): number {
  return Math.floor((day - villager.bornDay) / DAYS_PER_YEAR);
}

/** One named RNG stream cannot shift another feature's results. */
function channelRng(worldSeed: number, burgId: number, day: number, channel: string): SeededRandom {
  return new SeededRandom(
    seedFromPath(makeSeedPath(worldSeed, `burg:${burgId}`, `day:${day}`, `s:${channel}`)),
  );
}

// ============================================================================
// Daily Economy
// ============================================================================
// Adults pay a price-sensitive household cost. Workers receive occupation-aware
// income, shopkeepers earn from the number of local adults, and a stable home-
// plot bias makes otherwise similar districts diverge into richer and poorer
// places. Annual macro outcomes reuse the older event-grained economy contract.
// ============================================================================

/** Stable home-plot differences make district wealth observable without a new map contract. */
function districtWageBias(burgId: number, homePlotId: number): number {
  return (fnv1a(`burg:${burgId}:home:${homePlotId}:wage-bias`) % 5) - 2;
}

/** Recompute current home-plot wealth from living residents; dead history is excluded. */
function districtWealth(state: TownSimState): Record<number, number> {
  const byHome = new Map<number, number[]>();
  for (const villager of Object.values(state.villagers)) {
    if (!isAlive(villager)) continue;
    const values = byHome.get(villager.homePlotId) ?? [];
    values.push(villager.wealth);
    byHome.set(villager.homePlotId, values);
  }

  return Object.fromEntries(
    [...byHome.entries()]
      .sort(([left], [right]) => left - right)
      .map(([homePlotId, values]) => [
        homePlotId,
        Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
      ]),
  );
}

/** Apply wages, shop takings, prices, and the annual town-scale economy outcome. */
function advanceEconomy(
  state: TownSimState,
  roster: TownRoster,
  worldSeed: number,
  day: number,
): void {
  const deepening = state.agentDeepening!;
  const economy = deepening.economy;
  const livingOccupants = roster.occupants
    .filter((occupant) => isAlive(state.villagers[occupant.id]))
    .sort((left, right) => left.id - right.id);
  const adults = livingOccupants.filter((occupant) => occupant.ageBand !== 'child');
  const shopkeepers = adults.filter(
    (occupant) => occupant.occupation === 'shopkeeper' && occupant.workPlotId !== undefined,
  );
  const shopCount = Math.max(1, new Set(shopkeepers.map((occupant) => occupant.workPlotId)).size);

  // Existing annual outcomes remain the macro story. This channel is separate
  // from life-event draws, so adding a shop or relationship never rerolls a death.
  if (day > 0 && day % DAYS_PER_YEAR === 0) {
    const outcome = rollAnnualEconomy(channelRng(worldSeed, state.burgId, day, 'agent-economy'));
    if (outcome.kind !== 'steady') {
      for (const villager of Object.values(state.villagers)) {
        if (!isAlive(villager)) continue;
        villager.wealth = clamp(villager.wealth + outcome.wealthDelta, 0, MAX_WEALTH);
      }
      state.prosperity = clamp((state.prosperity ?? 50) + outcome.prosperityDelta, 0, 100);
      addEvent(state, day, 'economy', 0, [], outcome.summary);
    }
  }

  // Current weather and prosperity move prices. Integer prices keep saved state
  // compact and make direct equality a sufficient replay proof.
  const weatherPressure = {
    mild: 0,
    storm: 12,
    drought: 18,
    cold_snap: 9,
  }[deepening.townEvents.weather];
  economy.priceIndex = clamp(
    Math.round(100 + weatherPressure + (50 - (state.prosperity ?? 50)) * 0.4),
    60,
    180,
  );

  // Daily household costs are paid by every living roster member. Adult workers
  // then receive bounded occupation-aware income; shop takings stay attached to
  // real work plots so no parallel district or business registry is invented.
  for (const occupant of livingOccupants) {
    const villager = state.villagers[occupant.id];
    const householdCost = occupant.ageBand === 'child'
      ? 1
      : Math.max(2, Math.round(economy.priceIndex / 45));
    let income = 0;

    if (occupant.ageBand !== 'child' && occupant.workPlotId !== undefined) {
      if (occupant.occupation === 'shopkeeper') {
        income = Math.max(4, Math.round((adults.length / shopCount) * economy.priceIndex / 100));
        const previous = economy.shopIncomeByPlot[occupant.workPlotId] ?? 0;
        economy.shopIncomeByPlot[occupant.workPlotId] = clamp(
          previous + income,
          0,
          MAX_SHOP_INCOME,
        );
      } else if (occupant.occupation === 'artisan') {
        income = 7;
      } else {
        income = 4;
      }
      income += districtWageBias(state.burgId, occupant.homePlotId);
    }

    villager.wealth = clamp(villager.wealth + income - householdCost, 0, MAX_WEALTH);
  }

  economy.districtWealthByHomePlot = districtWealth(state);
  economy.lastUpdatedDay = day;
}

// ============================================================================
// Repeated-Contact Relationships
// ============================================================================
// Contact comes only from facts the roster already owns: a shared home or work
// plot. Each sorted group meets adjacent neighbours, keeping work linear and the
// bond count proportional to population. Stable chemistry can make colleagues
// friends or rivals; sufficiently close unrelated adults court, then marry after
// the existing courtship duration.
// ============================================================================

interface ContactPair {
  leftId: number;
  rightId: number;
  sharedHome: boolean;
  sharedWork: boolean;
}

/** Canonical pair keys make A/B and B/A the same saved relationship. */
function pairKey(leftId: number, rightId: number): string {
  return leftId < rightId ? `${leftId}:${rightId}` : `${rightId}:${leftId}`;
}

/** Add adjacent meetings for one place; large workplaces never create an N-squared graph. */
function addGroupContacts(
  contacts: Map<string, ContactPair>,
  members: Occupant[],
  kind: 'home' | 'work',
): void {
  const sorted = members.slice().sort((left, right) => left.id - right.id);
  if (sorted.length < 2) return;

  const pairCount = sorted.length === 2 ? 1 : sorted.length;
  for (let index = 0; index < pairCount; index += 1) {
    const left = sorted[index];
    const right = sorted[(index + 1) % sorted.length];
    const key = pairKey(left.id, right.id);
    const existing = contacts.get(key) ?? {
      leftId: Math.min(left.id, right.id),
      rightId: Math.max(left.id, right.id),
      sharedHome: false,
      sharedWork: false,
    };
    existing.sharedHome ||= kind === 'home';
    existing.sharedWork ||= kind === 'work';
    contacts.set(key, existing);
  }
}

/** Build a bounded daily contact list from shared homes and workplaces. */
function contactPairs(state: TownSimState, roster: TownRoster): ContactPair[] {
  const contacts = new Map<string, ContactPair>();
  const living = roster.occupants.filter((occupant) => isAlive(state.villagers[occupant.id]));
  const homes = new Map<number, Occupant[]>();
  const workplaces = new Map<number, Occupant[]>();

  for (const occupant of living) {
    const homeGroup = homes.get(occupant.homePlotId) ?? [];
    homeGroup.push(occupant);
    homes.set(occupant.homePlotId, homeGroup);
    if (occupant.workPlotId !== undefined && occupant.ageBand !== 'child') {
      const workGroup = workplaces.get(occupant.workPlotId) ?? [];
      workGroup.push(occupant);
      workplaces.set(occupant.workPlotId, workGroup);
    }
  }

  for (const members of homes.values()) addGroupContacts(contacts, members, 'home');
  for (const members of workplaces.values()) addGroupContacts(contacts, members, 'work');
  return [...contacts.values()].sort(
    (left, right) => left.leftId - right.leftId || left.rightId - right.rightId,
  );
}

/** Parent, child, and sibling pairs remain ineligible for courtship. */
function isCloseKin(left: LivingVillager, right: LivingVillager): boolean {
  if (left.parentIds.includes(right.occupantId) || left.childIds.includes(right.occupantId)) {
    return true;
  }
  return left.parentIds.some((parentId) => right.parentIds.includes(parentId));
}

/** Only living unpartnered adults in the ordinary marriage window may court. */
function canCourt(villager: LivingVillager, day: number): boolean {
  const age = ageOnDay(villager, day);
  return isAlive(villager)
    && villager.spouseId === undefined
    && villager.courtingId === undefined
    && age >= 18
    && age <= 65;
}

/** Drop stale pairs in stable priority order so relationship state stays bounded. */
function boundRelationships(state: TownSimState, day: number): void {
  const relationships = state.agentDeepening!.relationships;
  const livingCount = Object.values(state.villagers).filter(isAlive).length;
  const limit = livingCount * MAX_BONDS_PER_LIVING_VILLAGER;
  const retained = Object.entries(relationships)
    .filter(([, bond]) => {
      const left = state.villagers[bond.leftId];
      const right = state.villagers[bond.rightId];
      if (!isAlive(left) || !isAlive(right)) return false;
      const protectedPair = left.spouseId === right.occupantId
        || left.courtingId === right.occupantId;
      return protectedPair || day - bond.lastContactDay <= BOND_IDLE_RETENTION_DAYS;
    })
    .sort(([, left], [, right]) =>
      right.lastContactDay - left.lastContactDay
      || Math.abs(right.affinity) - Math.abs(left.affinity)
      || left.leftId - right.leftId
      || left.rightId - right.rightId)
    .slice(0, limit)
    .sort(([left], [right]) => left.localeCompare(right));

  state.agentDeepening!.relationships = Object.fromEntries(retained);
}

/** Fold one day of contacts into affinity, friendships, rivalries, and marriages. */
function advanceRelationships(
  state: TownSimState,
  roster: TownRoster,
  worldSeed: number,
  day: number,
): void {
  const relationships = state.agentDeepening!.relationships;

  // A death can end a courtship before this optional layer sees the day. Clear
  // both directions here so no living person remains paired with genealogical history.
  for (const villager of Object.values(state.villagers)) {
    if (!isAlive(villager) || villager.courtingId === undefined) continue;
    const partner = state.villagers[villager.courtingId];
    if (!isAlive(partner) || partner.courtingId !== villager.occupantId) {
      villager.courtingId = undefined;
      villager.courtshipStartDay = undefined;
    }
  }

  for (const contact of contactPairs(state, roster)) {
    const left = state.villagers[contact.leftId];
    const right = state.villagers[contact.rightId];
    if (!isAlive(left) || !isAlive(right)) continue;
    const key = pairKey(left.occupantId, right.occupantId);
    const existing = relationships[key] ?? {
      leftId: contact.leftId,
      rightId: contact.rightId,
      affinity: 0,
      contactDays: 0,
      status: 'acquaintance' as const,
      lastContactDay: day - 1,
    };

    // Shared homes are usually supportive. Colleagues receive stable chemistry
    // from -3..3, which lets long contact honestly produce either friendship or rivalry.
    const chemistry = (fnv1a(
      `seed:${worldSeed}:burg:${state.burgId}:bond:${key}:chemistry`,
    ) % 7) - 3;
    const contactDelta = (contact.sharedHome ? 3 : 0) + (contact.sharedWork ? chemistry : 0);
    const bond: AgentRelationshipBond = {
      ...existing,
      affinity: clamp(existing.affinity + contactDelta, -100, 100),
      contactDays: clamp(existing.contactDays + 1, 0, MAX_CONTACT_DAYS),
      lastContactDay: day,
    };

    // A mutual courtship matures using the already-established duration. The
    // canonical spouse links are changed before future life days roll, so births
    // and inheritance continue through the original genealogy engine.
    const mutualCourtship = left.courtingId === right.occupantId
      && right.courtingId === left.occupantId;
    if (
      mutualCourtship
      && day - Math.max(left.courtshipStartDay ?? day, right.courtshipStartDay ?? day)
        >= COURTSHIP_DAYS
    ) {
      left.spouseId = right.occupantId;
      right.spouseId = left.occupantId;
      left.courtingId = undefined;
      right.courtingId = undefined;
      left.courtshipStartDay = undefined;
      right.courtshipStartDay = undefined;
      bond.status = 'friend';
      addEvent(
        state,
        day,
        'marriage',
        left.occupantId,
        [right.occupantId],
        `${left.name} married ${right.name} after a long friendship.`,
      );
    } else if (mutualCourtship) {
      bond.status = 'courting';
    } else if (
      bond.affinity >= 60
      && bond.contactDays >= 15
      && canCourt(left, day)
      && canCourt(right, day)
      && !isCloseKin(left, right)
    ) {
      left.courtingId = right.occupantId;
      right.courtingId = left.occupantId;
      left.courtshipStartDay = day;
      right.courtshipStartDay = day;
      bond.status = 'courting';
      addEvent(
        state,
        day,
        'courtship',
        left.occupantId,
        [right.occupantId],
        `${left.name} and ${right.name} grew close through daily companionship.`,
      );
    } else if (bond.affinity >= 40) {
      bond.status = 'friend';
    } else if (bond.affinity <= -35) {
      bond.status = 'rival';
    } else {
      bond.status = 'acquaintance';
    }

    relationships[key] = bond;
  }

  boundRelationships(state, day);
}

// ============================================================================
// Festivals, Fire, Crime, And Weather
// ============================================================================
// Fixed festivals reuse the existing calendar. Every thirty days a separate
// named stream may produce fire, crime, or notable weather. Consequences are
// intentionally bounded economic pressure rather than a second death path;
// natural death and genealogy remain exclusively owned by the life-event core.
// ============================================================================

/** Apply one notable town incident after economy and relationships for stable ordering. */
function advanceTownEvents(state: TownSimState, worldSeed: number, day: number): void {
  const dayOfYear = ((day % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
  for (const festival of festivalsOnDayOfYear(dayOfYear, state.burgId)) {
    state.prosperity = clamp((state.prosperity ?? 50) + 1, 0, 100);
    addEvent(state, day, 'festival', 0, [], `The town held ${festival}.`);
  }

  if (day <= 0 || day % TOWN_EVENT_INTERVAL_DAYS !== 0) {
    state.agentDeepening!.townEvents.lastUpdatedDay = day;
    return;
  }

  const roll = channelRng(worldSeed, state.burgId, day, 'agent-town-events').next();
  const townEvents = state.agentDeepening!.townEvents;
  let summary = '';

  if (roll < 0.06) {
    townEvents.weather = 'mild';
    state.prosperity = clamp((state.prosperity ?? 50) - 5, 0, 100);
    for (const villager of Object.values(state.villagers)) {
      if (isAlive(villager)) villager.wealth = clamp(villager.wealth - 2, 0, MAX_WEALTH);
    }
    summary = disasterSummary('fire');
  } else if (roll < 0.14) {
    townEvents.weather = 'mild';
    state.prosperity = clamp((state.prosperity ?? 50) - 3, 0, 100);
    for (const villager of Object.values(state.villagers)) {
      if (isAlive(villager)) villager.wealth = clamp(villager.wealth - 4, 0, MAX_WEALTH);
    }
    summary = disasterSummary('crime_wave');
  } else if (roll < 0.28) {
    townEvents.weather = 'storm';
    state.prosperity = clamp((state.prosperity ?? 50) - 2, 0, 100);
    summary = 'A season of hard storms flooded roads and raised market prices.';
  } else if (roll < 0.40) {
    townEvents.weather = 'drought';
    state.prosperity = clamp((state.prosperity ?? 50) - 3, 0, 100);
    summary = 'A dry spell thinned wells and made food dearer.';
  } else if (roll < 0.50) {
    townEvents.weather = 'cold_snap';
    state.prosperity = clamp((state.prosperity ?? 50) - 1, 0, 100);
    summary = 'A bitter cold snap slowed work across the town.';
  } else {
    townEvents.weather = 'mild';
  }

  if (summary) addEvent(state, day, 'disaster', 0, [], summary);
  townEvents.lastUpdatedDay = day;
}

/** Retain recent narrative while keeping ids monotonic across pruned history. */
function pruneChronicle(state: TownSimState, day: number): void {
  const cutoff = day - CHRONICLE_RETENTION_DAYS;
  if (cutoff <= 0) return;
  state.chronicle.events = state.chronicle.events.filter((event) => event.day >= cutoff);
}

// ============================================================================
// Public Daily Seam
// ============================================================================
// The caller advances canonical life events first, then hands that fresh state
// here. The order is always life -> economy -> relationships -> town events,
// which fixes chronicle ordering without sharing random streams between layers.
// ============================================================================

/** Advance one already-life-processed day of optional agent-sim deepening. */
export function advanceAgentDeepeningDay(
  state: TownSimState,
  roster: TownRoster,
  worldSeed: number,
  day: number,
): TownSimState {
  const next = cloneForDeepening(state);
  next.agentDeepening ??= initializeDeepening(day);

  advanceEconomy(next, roster, worldSeed, day);
  advanceRelationships(next, roster, worldSeed, day);
  advanceTownEvents(next, worldSeed, day);
  pruneChronicle(next, day);
  return next;
}
