/**
 * @file shopLife.ts — Shop keepers and personal fortune in the living-world sim.
 *
 * NPC lives (2026-11-02). Before this file the sim never changed who kept a
 * shop, and wealth moved only by flat town-wide amounts and inheritance. These
 * rules add three changes that a player can notice over days and weeks:
 *  1. Shop succession. When a keeper dies, the shop passes to a living adult
 *     heir who keeps no other shop (eldest child first, then the spouse). With
 *     no heir, the shop closes. No rng: the same deaths give the same result.
 *  2. Shop reopening. At a year boundary, a shop closed for at least one year
 *     reopens under the wealthiest living roleless adult who keeps no shop
 *     (ties go to the lower id). No rng.
 *  3. Personal fortune. At a year boundary, each living adult's wealth moves by
 *     a personal amount. The amount comes from a SEPARATE seeded stream per
 *     (worldSeed, burgId, day, occupantId), never from the life-event rng, so
 *     every existing death, birth and economy draw stays byte-identical.
 *
 * PRESERVED: old saves without `shops` stay "untracked"; rules 1 and 2 then do
 * nothing. Rule 3 runs for every town (it needs no shop record).
 *
 * All functions here are pure apart from the explicit `state` argument that
 * rollTownDay already owns as its private clone.
 */

import { SeededRandom } from '../../../utils/random/seededRandom';
import type { BusinessType } from '../../../types/business';
import type { TownPlan } from '../artifacts';
import type { TownRoster } from '../roster/types';
import type { TownLifeVillager } from '../roster/agentLife';
import { makeSeedPath, seedFromPath } from '../seedPath';
import { BASELINE_WEALTH, DAYS_PER_YEAR } from './constants';
import { lifespanForRace } from './lifespans';
import { businessTypeForTownPlot } from './townBusinessIdentity';
import type {
  LifeEventKind,
  LivingVillager,
  TownChronicle,
  TownShopRecord,
  TownSimState,
} from './types';

// ============================================================================
// Tuning
// ============================================================================

/** Wealth at or above this value is "rich": two times the starting wealth. */
export const RICH_WEALTH = BASELINE_WEALTH * 2;
/** Wealth at or below this value is "poor": two fifths of the starting wealth. */
export const POOR_WEALTH = Math.round(BASELINE_WEALTH * 0.4);
/** Yearly personal change for the keeper of an open shop (inclusive range).
 * The mean is +6, so keepers trend up over the years. */
export const KEEPER_FORTUNE_RANGE: readonly [number, number] = [-2, 14];
/** Yearly personal change for every other adult (inclusive range, mean 0). */
export const DRIFT_FORTUNE_RANGE: readonly [number, number] = [-10, 10];

/** Plain nouns for each business type, for diary lines. */
const TRADE_NOUN: Record<BusinessType, string> = {
  tavern: 'tavern',
  smithy: 'smithy',
  apothecary: 'apothecary',
  general_store: 'general store',
  trading_company: 'trading house',
  mine: 'mine',
  farm: 'farm',
  enchanter_shop: "enchanter's shop",
};

// ============================================================================
// Small helpers (local copies avoid an import cycle with townSim.ts)
// ============================================================================

const isAlive = (v: LivingVillager): boolean => v.diedDay === undefined;

function isAdult(v: LivingVillager, day: number): boolean {
  return Math.floor((day - v.bornDay) / DAYS_PER_YEAR) >= lifespanForRace(v.race).comingOfAge;
}

function pushEvent(
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

/** Plot ids in numeric order, so object key order never changes a result. */
function sortedPlotIds(shops: Record<number, TownShopRecord>): number[] {
  return Object.keys(shops).map(Number).sort((a, b) => a - b);
}

/** occupantIds that keep an open shop now. */
function shopKeeperIds(shops: Record<number, TownShopRecord>): Set<number> {
  const ids = new Set<number>();
  for (const plotId of sortedPlotIds(shops)) {
    const keeperId = shops[plotId].keeperId;
    if (keeperId !== null) ids.add(keeperId);
  }
  return ids;
}

const tradeOf = (record: TownShopRecord): string => record.trade ?? 'shop';

// ============================================================================
// Seeding (registration)
// ============================================================================

/**
 * Seed one record per market or workshop plot from the canonical roster. The
 * keeper is the occupant whose workPlotId is that plot (the same person the
 * merchant registration names). A plot with no worker starts closed, so it can
 * reopen under a new keeper after one year.
 */
export function seedShopsFromRoster(
  plan: Pick<TownPlan, 'plots'>,
  roster: TownRoster,
  startDay: number,
): Record<number, TownShopRecord> {
  const shops: Record<number, TownShopRecord> = {};
  const plots = plan.plots
    .filter((plot) => plot.role === 'market' || plot.role === 'workshop')
    .sort((a, b) => a.id - b.id);
  for (const plot of plots) {
    const worker = roster.occupants.find((o) => o.workPlotId === plot.id);
    const trade = TRADE_NOUN[businessTypeForTownPlot(plot.role, plot.id, plot.pop?.buildingType)];
    shops[plot.id] = worker
      ? { keeperId: worker.id, sinceDay: startDay, trade }
      : { keeperId: null, sinceDay: startDay, closedDay: startDay, trade };
  }
  return shops;
}

// ============================================================================
// Rule 1: succession on death
// ============================================================================

/**
 * Pass every shop the deceased kept to an heir, or close it. Called from
 * killVillager, so a natural death and a disaster death behave the same. The
 * heir is the eldest living adult child who keeps no shop, then the living
 * adult spouse who keeps no shop. Mutates `state` (rollTownDay's clone).
 */
export function transferShopOnDeath(state: TownSimState, deceased: LivingVillager, day: number): void {
  const shops = state.shops;
  if (!shops) return; // untracked (old save): no shop rule applies
  for (const plotId of sortedPlotIds(shops)) {
    const record = shops[plotId];
    if (record.keeperId !== deceased.occupantId) continue;
    const holders = shopKeeperIds(shops);
    const eligible = (v: LivingVillager | undefined): v is LivingVillager =>
      v !== undefined && isAlive(v) && isAdult(v, day) && !holders.has(v.occupantId);

    const children = deceased.childIds
      .map((id) => state.villagers[id])
      .filter(eligible)
      .sort((a, b) => a.bornDay - b.bornDay || a.occupantId - b.occupantId);
    const spouse = deceased.spouseId !== undefined ? state.villagers[deceased.spouseId] : undefined;
    const heir = children[0] ?? (eligible(spouse) ? spouse : undefined);

    if (heir) {
      shops[plotId] = { keeperId: heir.occupantId, sinceDay: day, trade: record.trade };
      const relation = children[0] === heir ? 'their parent' : 'their spouse';
      pushEvent(
        state.chronicle,
        day,
        'shop_succession',
        heir.occupantId,
        [deceased.occupantId],
        `${heir.name} took over the ${tradeOf(record)} after the death of ${relation} ${deceased.name}.`,
      );
    } else {
      shops[plotId] = { keeperId: null, sinceDay: record.sinceDay, closedDay: day, trade: record.trade };
      // Living close kin are related: the closure touches their household.
      const kin = [
        ...(spouse && isAlive(spouse) ? [spouse.occupantId] : []),
        ...deceased.childIds.filter((id) => state.villagers[id] && isAlive(state.villagers[id])),
      ].sort((a, b) => a - b);
      pushEvent(
        state.chronicle,
        day,
        'shop_closed',
        deceased.occupantId,
        kin,
        `The ${tradeOf(record)} closed after ${deceased.name} died with no heir to keep it.`,
      );
    }
  }
}

// ============================================================================
// Rule 2: reopening at a year boundary
// ============================================================================

/**
 * Reopen each shop closed for at least one year under the wealthiest living
 * roleless adult who keeps no shop (ties: lower id). Caller runs this only on
 * a year-boundary day in full mode. Mutates `state`.
 */
export function reopenClosedShops(state: TownSimState, day: number): void {
  const shops = state.shops;
  if (!shops) return;
  for (const plotId of sortedPlotIds(shops)) {
    const record = shops[plotId];
    if (record.keeperId !== null || record.closedDay === undefined) continue;
    if (day - record.closedDay < DAYS_PER_YEAR) continue;
    const holders = shopKeeperIds(shops);
    const keeper = Object.values(state.villagers)
      .filter((v) => isAlive(v) && isAdult(v, day) && !v.role && !holders.has(v.occupantId))
      .sort((a, b) => b.wealth - a.wealth || a.occupantId - b.occupantId)[0];
    if (!keeper) continue; // nobody can take it; it stays closed
    const years = Math.floor((day - record.closedDay) / DAYS_PER_YEAR);
    shops[plotId] = { keeperId: keeper.occupantId, sinceDay: day, trade: record.trade };
    pushEvent(
      state.chronicle,
      day,
      'shop_opened',
      keeper.occupantId,
      [],
      `${keeper.name} reopened the ${tradeOf(record)}, which had stood closed for ${years} ${years === 1 ? 'year' : 'years'}.`,
    );
  }
}

// ============================================================================
// Rule 3: personal fortune at a year boundary
// ============================================================================

/** The separate per-person stream. Never the life-event rng. */
export function fortuneStream(worldSeed: number, burgId: number, day: number, occupantId: number): SeededRandom {
  return new SeededRandom(
    seedFromPath(makeSeedPath(worldSeed, `burg:${burgId}`, `day:${day}`, `s:fortune:${occupantId}`)),
  );
}

/**
 * Move each living adult's wealth by a personal amount (clamped at 0). Keepers
 * of open shops trend up; other adults drift. `wealthAtYearStart` holds the
 * meters from before this day's economy and disaster passes, so a villager who
 * crosses a threshold for any reason this year gets one fortune line:
 * fortune_rose on reaching RICH_WEALTH, fortune_fell on reaching POOR_WEALTH.
 * Mutates `state`.
 */
export function applyPersonalFortune(
  state: TownSimState,
  day: number,
  worldSeed: number,
  wealthAtYearStart: ReadonlyMap<number, number>,
): void {
  const keepers = state.shops ? shopKeeperIds(state.shops) : new Set<number>();
  const ids = Object.values(state.villagers)
    .filter((v) => isAlive(v) && isAdult(v, day))
    .map((v) => v.occupantId)
    .sort((a, b) => a - b);
  for (const id of ids) {
    const v = state.villagers[id];
    const [min, max] = keepers.has(id) ? KEEPER_FORTUNE_RANGE : DRIFT_FORTUNE_RANGE;
    const delta = fortuneStream(worldSeed, state.burgId, day, id).nextInt(min, max + 1);
    const before = wealthAtYearStart.get(id) ?? v.wealth;
    v.wealth = Math.max(0, v.wealth + delta);
    if (before < RICH_WEALTH && v.wealth >= RICH_WEALTH) {
      pushEvent(state.chronicle, day, 'fortune_rose', id, [], `${v.name} has grown prosperous.`);
    } else if (before > POOR_WEALTH && v.wealth <= POOR_WEALTH) {
      pushEvent(state.chronicle, day, 'fortune_fell', id, [], `${v.name} has fallen on hard times.`);
    }
  }
}

// ============================================================================
// Readers (attendance, merchant registration, talk list)
// ============================================================================

/** The minimum life view a reader needs: villagers plus optional shop records. */
export interface ShopLifeView {
  villagers: Readonly<Record<number, TownLifeVillager>>;
  shops?: Record<number, TownShopRecord>;
}

export type ShopKeeperStatus =
  | { status: 'untracked' }
  | { status: 'open'; keeper: TownLifeVillager; sinceDay: number }
  | { status: 'closed'; closedDay: number }
  | { status: 'unresolved' };

/**
 * Who keeps this plot's shop on `day`, from the saved record. "untracked"
 * means old save or not a shop plot: callers keep their established behavior.
 * "unresolved" means the record names a keeper the town does not hold (pruned
 * or corrupt); callers must not invent staff for it.
 */
export function shopKeeperAt(
  life: ShopLifeView | undefined,
  plotId: number | undefined,
  day: number,
): ShopKeeperStatus {
  if (!life?.shops || plotId === undefined) return { status: 'untracked' };
  const record = life.shops[plotId];
  if (!record) return { status: 'untracked' };
  if (record.keeperId === null) {
    return record.closedDay !== undefined ? { status: 'closed', closedDay: record.closedDay } : { status: 'unresolved' };
  }
  const keeper = life.villagers[record.keeperId];
  if (!keeper || keeper.occupantId !== record.keeperId) return { status: 'unresolved' };
  if (keeper.bornDay > day || (keeper.diedDay !== undefined && keeper.diedDay <= day)) return { status: 'unresolved' };
  return { status: 'open', keeper, sinceDay: record.sinceDay };
}
