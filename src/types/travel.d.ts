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
export declare const PACE_MODIFIERS: Record<TravelPace, TravelPaceEffect>;
export declare const TERRAIN_TRAVEL_MODIFIERS: Record<TravelTerrain, number>;
export type TravelMethod = 'walking' | 'mounted' | 'vehicle';
export interface TravelVehicle {
    id: string;
    name: string;
    speed: number;
    capacityWeight: number;
    type: 'land' | 'water' | 'air';
    /**
     * Berth size a water vehicle needs (travel G14). 'small' craft fit any port;
     * larger hulls need a bigger dock or they anchor offshore and land by tender.
     * Only meaningful for `type: 'water'`; omit for land/air (treated as 'small').
     */
    dockClass?: 'small' | 'medium' | 'large';
}
/**
 * Standard D&D 5e mounts and vehicles.
 * Speed: ft/round (divide by 10 for MPH).
 * Rowboat (1.5 mph) -> 15 ft/round.
 * Keelboat (3 mph) -> 30 ft/round.
 * Galley (4 mph) -> 40 ft/round.
 * Warship (2.5 mph) -> 25 ft/round.
 */
export declare const STANDARD_VEHICLES: Record<string, TravelVehicle>;
export interface TransportOption {
    method: TravelMethod;
    vehicle?: TravelVehicle;
}
export interface TravelPartyMember {
    /** Optional identifier used by systems that resolve travelers to character entities. */
    id?: string;
    /** Human-readable label when available. */
    name?: string;
    /** Group-specific role or responsibility for UI/UX surfaces. */
    role?: string;
    /** Catch-all extension to avoid forcing upstream migration before schema settles. */
    [key: string]: unknown;
}
export interface TravelInventoryItem {
    /** Optional item identifier to allow explicit inventory schema migration. */
    id?: string;
    /** Optional stack size when this data is inventory-like. */
    quantity?: number;
    /** Catch-all extension for item metadata. */
    [key: string]: unknown;
}
export type TravelInventoryMap = Record<string, TravelInventoryItem[]>;
export interface TravelParameters {
    origin: {
        x: number;
        y: number;
    };
    destination: {
        x: number;
        y: number;
    };
    /** Speed of the slowest member in feet per round (e.g. 30) */
    baseSpeed: number;
    pace: TravelPace;
    /** Terrain type for the journey (defaults to 'open') */
    terrain?: TravelTerrain;
    /** Encumbrance status of the group (affects speed) */
    isEncumbered?: boolean;
}
export interface GroupTravelParameters {
    origin: {
        x: number;
        y: number;
    };
    destination: {
        x: number;
        y: number;
    };
    travelers: TravelPartyMember[];
    inventories: TravelInventoryMap;
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
