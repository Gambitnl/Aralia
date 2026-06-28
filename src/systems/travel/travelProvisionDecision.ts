/**
 * @file travelProvisionDecision.ts — turn a planned trip + carried supplies into
 * the gate's verdict: the multi-resource status, the sustainable travel-days (for
 * the partial-stop halt cell), and the rations/water to spend.
 *
 * Pure: takes resource-day counts (not inventory) and trip-days (not a route), so
 * App's in-range spend and MapPane's underprovisioned choice flow share one rule.
 * Mounts/NPC consumers are deferred — `partySize` is the single consumer count.
 */
import {
  dailyNeed,
  provisionStatusMulti,
  type RationMode,
  type MultiProvisionStatus,
} from './provisioning';

export interface TravelProvisionInput {
  /** Ration-days of food carried. */
  foodDays: number;
  /** Water-days carried. */
  waterDays: number;
  /** Number of consumers (party size). */
  partySize: number;
  /** Whole travel-days the trip costs. */
  tripDays: number;
  mode: RationMode;
  /** Food-days gained by foraging en route (extends the food horizon). */
  forageFoodDays?: number;
  /** Water-days gained by foraging/finding water en route. */
  forageWaterDays?: number;
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
}

/**
 * Resolve the provisioning decision for a trip. Foraging adds to the *horizon*
 * (so the trip may come into range) but the party still eats the rations/water it
 * actually carries — forage tops the supply up, it doesn't refund what's packed.
 */
export function decideTravelProvision(input: TravelProvisionInput): TravelProvisionDecision {
  const foodHorizonDays = input.foodDays + (input.forageFoodDays ?? 0);
  const waterHorizonDays = input.waterDays + (input.forageWaterDays ?? 0);

  const status = provisionStatusMulti({
    tripDays: input.tripDays,
    consumers: input.partySize,
    mode: input.mode,
    supplies: [
      { resource: 'food', days: foodHorizonDays },
      { resource: 'water', days: waterHorizonDays },
    ],
  });

  // foodRangeDays on a multi-status is the *binding* range (smaller of food/water).
  const sustainableDays = Math.min(input.tripDays, status.foodRangeDays);

  // Spend is over the carried supply only, for as long as the trip lasts.
  const need = dailyNeed(input.partySize, input.mode);
  const rationsToSpend = Math.min(input.foodDays, need * input.tripDays);
  const waterToSpend = Math.min(input.waterDays, need * input.tripDays);

  return { status, sustainableDays, rationsToSpend, waterToSpend };
}
