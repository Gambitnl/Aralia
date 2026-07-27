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
export declare const RATIONS_ITEM_ID = "rations";
/** Canonical one-day water item id (E1: water is a second consumable resource). */
export declare const WATER_ITEM_ID = "water-day";
export type RationMode = 'full' | 'half';
/** The consumable resources the provisioning model gates travel on. */
export type ProvisionResource = 'food' | 'water';
/** Canonical item id backing each provision resource. */
export declare const RESOURCE_ITEM_ID: Record<ProvisionResource, string>;
/**
 * Total resource-days of a given consumable id carried in the party inventory.
 * A stack's `quantity` is its resource-days; a stack with no quantity is 1 day.
 */
export declare function resourceDays(inventory: readonly Item[], resourceItemId: string): number;
/** Total ration-days (food) carried in the party inventory. */
export declare function daysOfFood(inventory: readonly Item[]): number;
/** Total water-days carried in the party inventory. */
export declare function daysOfWater(inventory: readonly Item[]): number;
/**
 * Per-day resource consumption for `consumers` people at the given ration mode,
 * scaled by a terrain/transport burn multiplier (E2). Rounds up to whole
 * resource-days since you cannot pack half a person-day of food.
 */
export declare function dailyNeed(consumers: number, mode: RationMode, burnMultiplier?: number): number;
/** Whole travel-days a trip of `minutes` costs (partial day rounds up). */
export declare function tripDaysFromMinutes(minutes: number): number;
/** How many travel-days the party can sustain on `days` of a resource. */
export declare function foodRangeDays(days: number, consumers: number, mode: RationMode, burnMultiplier?: number): number;
export declare function terrainBurnFactor(terrain: TravelTerrain, resource: ProvisionResource): number;
/** A single leg of a route, for time-weighting its burn factor. */
export interface BurnStep {
    minutes: number;
    burn: number;
}
/**
 * Time-weighted mean burn multiplier across a route's legs (E2). A trip that
 * spends most of its hours in harsh terrain burns near that leg's factor.
 */
export declare function meanBurnMultiplier(steps: readonly BurnStep[]): number;
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
export declare function bindingRangeDays(consumers: number, mode: RationMode, supplies: readonly ResourceSupply[]): BindingRange;
/** Total weight (lbs) of carried provisions (rations + water). */
export declare function provisionWeight(inventory: readonly Item[]): number;
/** Total weight (lbs) of the entire inventory — for encumbrance. */
export declare function inventoryWeight(inventory: readonly Item[]): number;
/**
 * Travel-speed multiplier from carried weight (E3), mirroring 5e variant
 * encumbrance as a fraction of the 30ft base: over the light threshold costs
 * −10ft (×2/3), over the heavy threshold −20ft (×1/3). This is the core tension
 * — packing more food/water for a long trip slows the trip, shrinking the reach
 * horizon. Zero thresholds (unknown party capacity) disable the gate (×1).
 */
export declare function encumbranceSpeedFactor(weightLbs: number, encumberedAt: number, heavilyAt: number): number;
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
export declare function provisionStatusForTrip(input: ProvisionInput): ProvisionStatus;
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
export declare function provisionStatusMulti(input: MultiProvisionInput): MultiProvisionStatus;
