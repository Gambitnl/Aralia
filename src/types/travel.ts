
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

export type TerrainType = 'road' | 'plains' | 'forest' | 'hills' | 'mountains' | 'swamp' | 'desert' | 'water';

export const TERRAIN_COSTS: Record<TerrainType, number> = {
  road: 0.8, // Good roads allow faster travel
  plains: 1.0, // Baseline
  forest: 1.5,
  hills: 1.5,
  mountains: 2.0, // Difficult terrain
  swamp: 2.0, // Difficult terrain
  desert: 1.5,
  water: 1.0, // Assumes boat/swim speed handling elsewhere, or standard speed
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

export interface GroupTravelParameters {
  origin: { x: number; y: number };
  destination: { x: number; y: number };
  travelers: any[]; // Avoid circular dependency on PlayerCharacter, cast in service
  inventories: Record<string, any[]>; // Avoid circular dependency on Item
  pace: TravelPace;
  /** Predominant terrain type for the journey (default: 'plains') */
  terrain?: TerrainType;
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
  /** The effective cost modifier used for the terrain */
  terrainCostModifier: number;
}
