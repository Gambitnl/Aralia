/**
 * @file provisioning.ts - pure travel-provisioning math.
 *
 * This first slice only counts carried rations. It stays independent of React,
 * reducers, route rendering, and starvation outcomes so later travel-gating work
 * can build on a tested helper instead of mixing inventory math into MapPane.
 */
import type { Item } from '@/types/items';
import type { TravelTerrain } from '@/types/travel';

/** Canonical one-day ration item id. A stack's `quantity` is its ration-days. */
export const RATIONS_ITEM_ID = 'rations';

/** Canonical one-day water item id (E1: water is a second consumable resource). */
export const WATER_ITEM_ID = 'water-day';

export type RationMode = 'full' | 'half';

/** The consumable resources the provisioning model gates travel on. */
export type ProvisionResource = 'food' | 'water';

/** Canonical item id backing each provision resource. */
export const RESOURCE_ITEM_ID: Record<ProvisionResource, string> = {
  food: RATIONS_ITEM_ID,
  water: WATER_ITEM_ID,
};

/** Severity threshold: a shortfall up to this fraction of the trip reads "minor". */
const MINOR_SHORTFALL_FRACTION = 1 / 3;

/**
 * Total resource-days of a given consumable id carried in the party inventory.
 * A stack's `quantity` is its resource-days; a stack with no quantity is 1 day.
 */
export function resourceDays(inventory: readonly Item[], resourceItemId: string): number {
  let total = 0;

  for (const item of inventory) {
    if (item.id === resourceItemId) {
      total += item.quantity ?? 1;
    }
  }

  return total;
}

/** Total ration-days (food) carried in the party inventory. */
export function daysOfFood(inventory: readonly Item[]): number {
  return resourceDays(inventory, RATIONS_ITEM_ID);
}

/** Total water-days carried in the party inventory. */
export function daysOfWater(inventory: readonly Item[]): number {
  return resourceDays(inventory, WATER_ITEM_ID);
}

/**
 * Per-day resource consumption for `consumers` people at the given ration mode,
 * scaled by a terrain/transport burn multiplier (E2). Rounds up to whole
 * resource-days since you cannot pack half a person-day of food.
 */
export function dailyNeed(consumers: number, mode: RationMode, burnMultiplier = 1): number {
  if (consumers <= 0) return 0;
  const base = mode === 'half' ? consumers / 2 : consumers;
  return Math.ceil(base * Math.max(0, burnMultiplier));
}

/** Whole travel-days a trip of `minutes` costs (partial day rounds up). */
export function tripDaysFromMinutes(minutes: number): number {
  return Math.ceil(Math.max(0, minutes) / (24 * 60));
}

/** How many travel-days the party can sustain on `days` of a resource. */
export function foodRangeDays(
  days: number,
  consumers: number,
  mode: RationMode,
  burnMultiplier = 1,
): number {
  const need = dailyNeed(consumers, mode, burnMultiplier);
  if (need <= 0) return Infinity; // no consumers → never gated (defensive)
  return Math.floor(days / need);
}

/**
 * Per-day burn factor for a resource on a given travel-terrain class (E2).
 * Harsh ground costs more food; open/exposed ground costs more water. Terrain
 * already slows travel *time*; this is the orthogonal cost to *supply* per day.
 */
const TERRAIN_BURN: Record<ProvisionResource, Record<TravelTerrain, number>> = {
  food: { road: 1, trail: 1, open: 1, difficult: 1.5 },
  water: { road: 1, trail: 1.05, open: 1.15, difficult: 1.35 },
};

export function terrainBurnFactor(terrain: TravelTerrain, resource: ProvisionResource): number {
  return TERRAIN_BURN[resource][terrain] ?? 1;
}

/** A single leg of a route, for time-weighting its burn factor. */
export interface BurnStep {
  minutes: number;
  burn: number;
}

/**
 * Time-weighted mean burn multiplier across a route's legs (E2). A trip that
 * spends most of its hours in harsh terrain burns near that leg's factor.
 */
export function meanBurnMultiplier(steps: readonly BurnStep[]): number {
  let totalMinutes = 0;
  let weighted = 0;
  for (const s of steps) {
    const m = Math.max(0, s.minutes);
    totalMinutes += m;
    weighted += m * s.burn;
  }
  if (totalMinutes <= 0) return 1; // empty route → no penalty (defensive)
  return weighted / totalMinutes;
}

/** A carried resource supply for binding-range computation. */
export interface ResourceSupply {
  resource: ProvisionResource;
  /** Resource-days carried. */
  days: number;
  /** Terrain/transport burn multiplier for this resource (default 1×). */
  burnMultiplier?: number;
}

export interface BindingRange {
  /** Travel-days sustainable before the *first* resource runs out. */
  rangeDays: number;
  /** Which resource runs out first, or null when nothing gates. */
  binding: ProvisionResource | null;
}

/**
 * The binding (smallest) sustainable range across all carried resources (E1).
 * The trip is gated by whichever resource — food or water — runs out first.
 */
export function bindingRangeDays(
  consumers: number,
  mode: RationMode,
  supplies: readonly ResourceSupply[],
): BindingRange {
  let rangeDays = Infinity;
  let binding: ProvisionResource | null = null;
  for (const s of supplies) {
    const range = foodRangeDays(s.days, consumers, mode, s.burnMultiplier ?? 1);
    if (range < rangeDays) {
      rangeDays = range;
      binding = s.resource;
    }
  }
  return { rangeDays, binding };
}

// ── E3: provision weight → encumbrance → travel speed ────────────────────────

/** Total weight (lbs) of carried provisions (rations + water). */
export function provisionWeight(inventory: readonly Item[]): number {
  let total = 0;
  for (const item of inventory) {
    if (item.id === RATIONS_ITEM_ID || item.id === WATER_ITEM_ID) {
      total += (item.weight ?? 0) * (item.quantity ?? 1);
    }
  }
  return total;
}

/** Total weight (lbs) of the entire inventory — for encumbrance. */
export function inventoryWeight(inventory: readonly Item[]): number {
  let total = 0;
  for (const item of inventory) total += (item.weight ?? 0) * (item.quantity ?? 1);
  return total;
}

/**
 * Travel-speed multiplier from carried weight (E3), mirroring 5e variant
 * encumbrance as a fraction of the 30ft base: over the light threshold costs
 * −10ft (×2/3), over the heavy threshold −20ft (×1/3). This is the core tension
 * — packing more food/water for a long trip slows the trip, shrinking the reach
 * horizon. Zero thresholds (unknown party capacity) disable the gate (×1).
 */
export function encumbranceSpeedFactor(weightLbs: number, encumberedAt: number, heavilyAt: number): number {
  if (encumberedAt <= 0 || heavilyAt <= 0) return 1; // capacity unknown → no penalty
  if (weightLbs <= encumberedAt) return 1;
  if (weightLbs <= heavilyAt) return 2 / 3;
  return 1 / 3;
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

/** Build a status object from a trip length and a sustainable range. */
function statusFromRange(tripDaysRaw: number, range: number): ProvisionStatus {
  const tripDays = Math.max(0, Math.floor(tripDaysRaw));
  const safeRange = Number.isFinite(range) ? range : tripDays; // no consumers → always in range
  const shortfallDays = Math.max(0, tripDays - safeRange);
  const inRange = shortfallDays === 0;
  let severity: ProvisionSeverity = 'none';
  if (!inRange) {
    severity = shortfallDays <= Math.ceil(tripDays * MINOR_SHORTFALL_FRACTION) ? 'minor' : 'major';
  }
  return { inRange, shortfallDays, severity, foodRangeDays: safeRange, tripDays };
}

/** Resolve a trip's provision status: in-range, shortfall, and severity bucket. */
export function provisionStatusForTrip(input: ProvisionInput): ProvisionStatus {
  const range = foodRangeDays(input.daysOfFood, input.consumers, input.mode);
  return statusFromRange(input.tripDays, range);
}

export interface MultiProvisionInput {
  tripDays: number;
  consumers: number;
  mode: RationMode;
  supplies: ResourceSupply[];
}

export type MultiProvisionStatus = ProvisionStatus & {
  /** Which resource runs out first, or null when nothing gates. */
  binding: ProvisionResource | null;
};

/**
 * Multi-resource trip status (E1): gates on whichever resource — food or water —
 * runs out first. `foodRangeDays` here is the *binding* range, and `binding`
 * names the limiting resource so the readout/ring can label the real constraint.
 */
export function provisionStatusMulti(input: MultiProvisionInput): MultiProvisionStatus {
  const { rangeDays, binding } = bindingRangeDays(input.consumers, input.mode, input.supplies);
  return { ...statusFromRange(input.tripDays, rangeDays), binding };
}
