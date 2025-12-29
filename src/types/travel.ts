
export type TravelPace = 'slow' | 'normal' | 'fast';

export type TravelTerrain = 'road' | 'trail' | 'open' | 'difficult';

export interface TravelPaceEffect {
  /** Multiplier for travel speed (e.g. 1.0 is normal, 1.33 is fast) */
  speedModifier: number;
  /** Whether the group has advantage on stealth checks while traveling */
  stealthAdvantage: boolean;
  /** Modifier to passive perception scores (e.g. -5 for fast pace) */
  perceptionModifier: number;
  /** Bonus/Penalty to Navigation checks (e.g. +5 for slow, -5 for fast) */
  navigationModifier: number;
}

export const PACE_MODIFIERS: Record<TravelPace, TravelPaceEffect> = {
  slow: { speedModifier: 0.67, stealthAdvantage: true, perceptionModifier: 0, navigationModifier: 5 }, // 5e: Slow pace grants +5 to navigation/tracking
  normal: { speedModifier: 1.0, stealthAdvantage: false, perceptionModifier: 0, navigationModifier: 0 },
  fast: { speedModifier: 1.33, stealthAdvantage: false, perceptionModifier: -5, navigationModifier: -5 }, // 5e: Fast pace imposes -5 to passive perception (and often navigation)
};

export const TERRAIN_TRAVEL_MODIFIERS: Record<TravelTerrain, number> = {
  road: 1.0,
  trail: 1.0,
  open: 1.0,
  difficult: 0.5, // 5e: Difficult terrain costs 2ft for every 1ft (half speed)
};

export type TravelMethod = 'walking' | 'mounted' | 'vehicle';

export interface TravelVehicle {
  id: string;
  name: string;
  speed: number; // Base speed in ft/round (or equivalent for vehicles)
  capacityWeight: number; // Carrying capacity in lbs
  type: 'land' | 'water' | 'air';
}

/**
 * Standard D&D 5e mounts and vehicles.
 * Speed: ft/round (divide by 10 for MPH).
 * Rowboat (1.5 mph) -> 15 ft/round.
 * Keelboat (3 mph) -> 30 ft/round.
 * Galley (4 mph) -> 40 ft/round.
 * Warship (2.5 mph) -> 25 ft/round.
 */
export const STANDARD_VEHICLES: Record<string, TravelVehicle> = {
  riding_horse: { id: 'riding_horse', name: 'Riding Horse', speed: 60, capacityWeight: 480, type: 'land' },
  warhorse: { id: 'warhorse', name: 'Warhorse', speed: 60, capacityWeight: 540, type: 'land' },
  cart: { id: 'cart', name: 'Cart', speed: 0, capacityWeight: 0, type: 'land' }, // Speed limited by puller
  wagon: { id: 'wagon', name: 'Wagon', speed: 0, capacityWeight: 0, type: 'land' }, // Speed limited by puller
  rowboat: { id: 'rowboat', name: 'Rowboat', speed: 15, capacityWeight: 0, type: 'water' },
  keelboat: { id: 'keelboat', name: 'Keelboat', speed: 30, capacityWeight: 3000, type: 'water' }, // Approx capacity
  galley: { id: 'galley', name: 'Galley', speed: 40, capacityWeight: 100000, type: 'water' },
  warship: { id: 'warship', name: 'Warship', speed: 25, capacityWeight: 50000, type: 'water' },
};

export interface TransportOption {
  method: TravelMethod;
  vehicle?: TravelVehicle; // Required if method is 'mounted' or 'vehicle' (unless vehicle speed is 0/dependent)
}

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
  transport?: TransportOption;
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

export type TravelDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface NavigationResult {
  /** Whether the navigation check was successful */
  success: boolean;
  /** The DC used for the check */
  dc: number;
  /** The roll result (d20 + mods) */
  roll: number;
  /** If lost, the direction the party actually moves */
  driftDirection: TravelDirection | null;
  /** Time spent confused or correcting course (hours) if failed */
  timePenaltyHours: number;
}
