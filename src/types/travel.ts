
export type TravelPace = 'slow' | 'normal' | 'fast';

export interface TravelPaceEffect {
  /** Multiplier for travel speed (e.g. 1.0 is normal, 1.33 is fast) */
  speedModifier: number;
  /** Whether the group has advantage on stealth checks while traveling */
  stealthAdvantage: boolean;
  /** Modifier to passive perception scores (e.g. -5 for fast pace) */
  perceptionModifier: number;
}

export const PACE_MODIFIERS: Record<TravelPace, TravelPaceEffect> = {
  slow: { speedModifier: 0.67, stealthAdvantage: true, perceptionModifier: 0 }, // 5e: Able to use stealth
  normal: { speedModifier: 1.0, stealthAdvantage: false, perceptionModifier: 0 },
  fast: { speedModifier: 1.33, stealthAdvantage: false, perceptionModifier: -5 },
};

export interface TravelParameters {
  origin: { x: number; y: number };
  destination: { x: number; y: number };
  /** Speed of the slowest member in feet per round (e.g. 30) */
  baseSpeed: number;
  pace: TravelPace;
  /** Encumbrance status of the group (affects speed) */
  isEncumbered?: boolean;
}

export interface TravelResult {
  /** Total distance in miles */
  distanceMiles: number;
  /** Estimated travel time in hours */
  travelTimeHours: number;
  /** Adjusted travel speed in miles per hour */
  travelSpeedMph: number;
  /** Number of random encounter checks required */
  encounterChecks: number;
}
