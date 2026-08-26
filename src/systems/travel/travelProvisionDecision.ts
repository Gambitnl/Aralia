/**
 * @file travelProvisionDecision.ts — turn a planned trip + carried supplies into
 * the gate's verdict: the multi-resource status, the sustainable travel-days (for
 * the partial-stop halt cell), and the rations/water to spend.
 *
 * Pure: takes resource-day counts (not inventory) and trip-days (not a route), so
 * App's in-range spend and MapPane's underprovisioned choice flow share one rule.
 * The travelling column is not only the player characters: hired followers and
 * NPC companions eat and drink as people do, and mounts/pack beasts draw on the
 * same packs at their own rate (agora-a2a9).
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/09/2026, 21:00:39
 * Dependents: components/MapPane.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {
  dailyNeed,
  provisionStatusMulti,
  type RationMode,
  type MultiProvisionStatus,
} from './provisioning';

/** Per-day draw of one consumer on each resource, in person-day units. */
export interface ConsumerWeight {
  /** Ration-days eaten per travel-day. */
  food: number;
  /** Water-days drunk per travel-day. */
  water: number;
}

/**
 * What each kind of traveller costs the packs per day.
 *
 * A person — party member, hireling, or NPC companion — is the unit: one
 * ration-day and one water-day. A mount grazes for most of its bulk feed, so the
 * carried rations only top it up (2 ration-days), but it cannot water itself on a
 * march and drinks roughly four times a person's day.
 */
export const CONSUMER_WEIGHT: Record<'person' | 'mount', ConsumerWeight> = {
  person: { food: 1, water: 1 },
  mount: { food: 2, water: 4 },
};

export interface TravelProvisionInput {
  /** Ration-days of food carried. */
  foodDays: number;
  /** Water-days carried. */
  waterDays: number;
  /** Number of player characters in the party. */
  partySize: number;
  /** Whole travel-days the trip costs. */
  tripDays: number;
  mode: RationMode;
  /** Food-days gained by foraging en route (extends the food horizon). */
  forageFoodDays?: number;
  /** Water-days gained by foraging/finding water en route. */
  forageWaterDays?: number;
  /**
   * Hirelings, followers, and NPC companions travelling with the party. They are
   * not in `partySize` but they draw on the same packs, one person's worth each.
   */
  followerCount?: number;
  /** Riding and pack beasts travelling with the column. */
  mountCount?: number;
}

export interface TravelProvisionDecision {
  status: MultiProvisionStatus;
  /**
   * Travel-days the party can actually sustain before its binding resource runs
   * out — `min(tripDays, bindingRange)`. The halt cell for a partial-stop is the
   * last route cell reachable within this many days.
   */
  sustainableDays: number;
  /** Rations to remove if the trip proceeds at this mode (capped at carried). */
  rationsToSpend: number;
  /** Water-days to remove if the trip proceeds at this mode (capped at carried). */
  waterToSpend: number;
  /** Person-equivalent food draw per day, before the ration mode is applied. */
  foodConsumers: number;
  /** Person-equivalent water draw per day, before the ration mode is applied. */
  waterConsumers: number;
}

/** A count that is never negative and never fractional. */
function count(value: number | undefined): number {
  return Math.max(0, Math.floor(value ?? 0));
}

/**
 * Resolve the provisioning decision for a trip. Foraging adds to the *horizon*
 * (so the trip may come into range) but the party still eats the rations/water it
 * actually carries — forage tops the supply up, it doesn't refund what's packed.
 *
 * People and mounts draw on the two resources at different rates, so food and
 * water each get their own person-equivalent consumer count. `provisionStatusMulti`
 * gates on a single consumer count with a per-resource burn multiplier, so the
 * count is one and each resource's whole draw rides in its burn multiplier —
 * `dailyNeed` then computes exactly that resource's own need, with no rounding
 * drift from a fractional share.
 */
export function decideTravelProvision(input: TravelProvisionInput): TravelProvisionDecision {
  const people = count(input.partySize) + count(input.followerCount);
  const mounts = count(input.mountCount);

  const foodConsumers = people * CONSUMER_WEIGHT.person.food + mounts * CONSUMER_WEIGHT.mount.food;
  const waterConsumers = people * CONSUMER_WEIGHT.person.water + mounts * CONSUMER_WEIGHT.mount.water;

  const foodHorizonDays = input.foodDays + (input.forageFoodDays ?? 0);
  const waterHorizonDays = input.waterDays + (input.forageWaterDays ?? 0);

  // One nominal consumer; each resource's real draw is its burn multiplier.
  // With no travellers at all the count is zero, which leaves the trip ungated.
  const nominalConsumers = foodConsumers > 0 || waterConsumers > 0 ? 1 : 0;

  const status = provisionStatusMulti({
    tripDays: input.tripDays,
    consumers: nominalConsumers,
    mode: input.mode,
    supplies: [
      { resource: 'food', days: foodHorizonDays, burnMultiplier: foodConsumers },
      { resource: 'water', days: waterHorizonDays, burnMultiplier: waterConsumers },
    ],
  });

  // foodRangeDays on a multi-status is the *binding* range (smaller of food/water).
  const sustainableDays = Math.min(input.tripDays, status.foodRangeDays);

  // Spend is over the carried supply only, for as long as the trip lasts.
  const foodNeed = dailyNeed(foodConsumers, input.mode);
  const waterNeed = dailyNeed(waterConsumers, input.mode);
  const rationsToSpend = Math.min(input.foodDays, foodNeed * input.tripDays);
  const waterToSpend = Math.min(input.waterDays, waterNeed * input.tripDays);

  return { status, sustainableDays, rationsToSpend, waterToSpend, foodConsumers, waterConsumers };
}
