
export type TravelPace = 'slow' | 'normal' | 'fast';

export type TravelTerrain = 'road' | 'trail' | 'open' | 'difficult';

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

export const TERRAIN_TRAVEL_MODIFIERS: Record<TravelTerrain, number> = {
  road: 1.0,
  trail: 1.0,
  open: 1.0,
  difficult: 0.5, // 5e: Difficult terrain costs 2ft for every 1ft (half speed)
};

export interface TravelParameters {
  origin: { x: number; y: number };
  destination: { x: number; y: number };
  /** Speed of the slowest member in feet per round (e.g. 30) */
  baseSpeed: number;
  pace: TravelPace;
  /** Terrain type for the journey (defaults to 'open') */
  terrain?: TravelTerrain;
  /** Encumbrance status of the group (affects speed) */
  isEncumbered?: boolean;
}

export interface GroupTravelParameters {
  origin: { x: number; y: number };
  destination: { x: number; y: number };
  travelers: any[]; // Avoid circular dependency on PlayerCharacter, cast in service
  inventories: Record<string, any[]>; // Avoid circular dependency on Item
  pace: TravelPace;
  /** Terrain type for the journey (defaults to 'open') */
  terrain?: TravelTerrain;
}

export interface TravelResult {
  /** Total distance in miles */
  distanceMiles: number;
  /** Estimated travel time in hours */
  travelTimeHours: number;
  /** Adjusted travel speed in miles per hour */
  travelSpeedMph: number;
  /** Terrain type used for calculation */
  usedTerrain: TravelTerrain;
  /** Number of random encounter checks required */
  encounterChecks: number;
}
