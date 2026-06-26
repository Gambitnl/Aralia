/**
 * @file provisioning.ts - pure travel-provisioning math.
 *
 * This first slice only counts carried rations. It stays independent of React,
 * reducers, route rendering, and starvation outcomes so later travel-gating work
 * can build on a tested helper instead of mixing inventory math into MapPane.
 */
import type { Item } from '@/types/items';

/** Canonical one-day ration item id. A stack's `quantity` is its ration-days. */
export const RATIONS_ITEM_ID = 'rations';

export type RationMode = 'full' | 'half';

/** Severity threshold: a shortfall up to this fraction of the trip reads "minor". */
const MINOR_SHORTFALL_FRACTION = 1 / 3;

/** Total ration-days carried in the party inventory. */
export function daysOfFood(inventory: readonly Item[]): number {
  let total = 0;

  for (const item of inventory) {
    if (item.id === RATIONS_ITEM_ID) {
      total += item.quantity ?? 1;
    }
  }

  return total;
}

/** Per-day ration consumption for `consumers` people at the given ration mode. */
export function dailyNeed(consumers: number, mode: RationMode): number {
  if (consumers <= 0) return 0;
  return mode === 'half' ? Math.ceil(consumers / 2) : consumers;
}

/** Whole travel-days a trip of `minutes` costs (partial day rounds up). */
export function tripDaysFromMinutes(minutes: number): number {
  return Math.ceil(Math.max(0, minutes) / (24 * 60));
}

/** How many travel-days the party can sustain before food runs out. */
export function foodRangeDays(days: number, consumers: number, mode: RationMode): number {
  const need = dailyNeed(consumers, mode);
  if (need <= 0) return Infinity; // no consumers → never gated (defensive)
  return Math.floor(days / need);
}

export type ProvisionSeverity = 'none' | 'minor' | 'major';

export interface ProvisionStatus {
  inRange: boolean;
  /** Travel-days the trip exceeds the food range (0 when in range). */
  shortfallDays: number;
  severity: ProvisionSeverity;
  foodRangeDays: number;
  tripDays: number;
}

export interface ProvisionInput {
  tripDays: number;
  daysOfFood: number;
  consumers: number;
  mode: RationMode;
}

/** Resolve a trip's provision status: in-range, shortfall, and severity bucket. */
export function provisionStatusForTrip(input: ProvisionInput): ProvisionStatus {
  const range = foodRangeDays(input.daysOfFood, input.consumers, input.mode);
  const tripDays = Math.max(0, Math.floor(input.tripDays));
  const safeRange = Number.isFinite(range) ? range : tripDays; // no consumers → always in range
  const shortfallDays = Math.max(0, tripDays - safeRange);
  const inRange = shortfallDays === 0;
  let severity: ProvisionSeverity = 'none';
  if (!inRange) {
    severity = shortfallDays <= Math.ceil(tripDays * MINOR_SHORTFALL_FRACTION) ? 'minor' : 'major';
  }
  return { inRange, shortfallDays, severity, foodRangeDays: safeRange, tripDays };
}
