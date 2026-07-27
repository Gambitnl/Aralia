/**
 * @file src/systems/travel/TravelCalculations.ts
 * Core calculations for travel, pace, and encumbrance.
 *
 * Implements 5e-style travel rules:
 * - Pace: Slow (Stealth), Normal, Fast (Penalty).
 * - Encumbrance: Variant encumbrance rules affecting speed.
 * - Group Speed: Limited by the slowest member.
 * - Terrain: Difficult terrain halves speed.
 * - Transport: Mounts and Vehicles override base walking speed.
 */
import { PlayerCharacter } from '../../types/character';
import { Item } from '../../types/items';
import { TravelPace, TravelTerrain, PACE_MODIFIERS, TransportOption } from '../../types/travel';
export { PACE_MODIFIERS };
export type EncumbranceLevel = 'unencumbered' | 'encumbered' | 'heavily_encumbered';
export interface EncumbranceResult {
    currentWeight: number;
    maxCarry: number;
    encumberedThreshold: number;
    heavilyEncumberedThreshold: number;
    level: EncumbranceLevel;
    speedDrop: number;
}
export interface TravelGroupStats {
    slowestMemberId: string;
    baseSpeed: number;
    travelSpeedMph: number;
    pace: TravelPace;
    terrain: TravelTerrain;
    terrainModifier: number;
    dailyDistanceMiles: number;
    transportMethod: string;
}
export interface ForcedMarchStatus {
    isForcedMarch: boolean;
    hoursOverLimit: number;
    constitutionSaveDC: number;
}
/**
 * Calculates the forced march status based on hours traveled.
 * Rules:
 * - Normal travel day is 8 hours.
 * - For each hour beyond 8, characters risk exhaustion.
 * - DC = 10 + 1 per hour past 8.
 */
export declare function calculateForcedMarchStatus(hoursTraveled: number): ForcedMarchStatus;
/**
 * Calculates the encumbrance level and effects for a character.
 * Implements "Variant Encumbrance" rules.
 */
export declare function calculateEncumbrance(character: PlayerCharacter, inventory: Item[]): EncumbranceResult;
/**
 * Calculates the effective travel speed for a group.
 * The group moves at the speed of its slowest member unless using a vehicle/mount.
 *
 * @param characters List of characters in the travel group
 * @param inventories Map of character ID to their specific inventory items
 * @param pace Selected travel pace
 * @param terrain Terrain type (affects speed multiplier)
 * @param transport Optional transport method (mounts, vehicles)
 */
export declare function calculateGroupTravelStats(characters: PlayerCharacter[], inventories: Record<string, Item[]>, pace?: TravelPace, terrain?: TravelTerrain, transport?: TransportOption): TravelGroupStats;
/**
 * Calculates travel time in hours for a given distance.
 */
export declare function calculateTravelTimeHours(distanceMiles: number, groupStats: TravelGroupStats): number;
