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
import {
  TravelPace,
  TravelTerrain,
  PACE_MODIFIERS,
  TERRAIN_TRAVEL_MODIFIERS,
  TransportOption
} from '../../types/travel';

export { PACE_MODIFIERS };

// --- Types ---

export type EncumbranceLevel = 'unencumbered' | 'encumbered' | 'heavily_encumbered';

export interface EncumbranceResult {
  currentWeight: number;
  maxCarry: number; // 15 * STR
  encumberedThreshold: number; // 5 * STR
  heavilyEncumberedThreshold: number; // 10 * STR
  level: EncumbranceLevel;
  speedDrop: number; // e.g. 0, 10, 20
}

export interface TravelGroupStats {
  slowestMemberId: string;
  baseSpeed: number; // Speed of slowest member (ft/round)
  travelSpeedMph: number; // Effective MPH including pace and terrain
  pace: TravelPace;
  terrain: TravelTerrain;
  terrainModifier: number;
  dailyDistanceMiles: number; // Assuming 8 hours
  transportMethod: string;
}

export interface ForcedMarchStatus {
  isForcedMarch: boolean;
  hoursOverLimit: number;
  constitutionSaveDC: number; // 0 if not forced
}

// --- Calculations ---

/**
 * Calculates the forced march status based on hours traveled.
 * Rules:
 * - Normal travel day is 8 hours.
 * - For each hour beyond 8, characters risk exhaustion.
 * - DC = 10 + 1 per hour past 8.
 */
export function calculateForcedMarchStatus(hoursTraveled: number): ForcedMarchStatus {
  const SAFE_TRAVEL_HOURS = 8;
  // TODO(lint-intent): 'isForcedMarch' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  const _isForcedMarch = hoursTraveled > SAFE_TRAVEL_HOURS;

  // Per 5e rules, the check is made at the end of each hour traveled beyond 8.
  // We floor the hours over limit to ensure we only count full hours completed past the limit for the DC scaling.
  // Example: 8.5 hours -> 0.5 hours over -> floor(0.5) = 0 -> No DC increase yet (or DC 10 base if we consider it forced).
  // However, "Forced March" applies to *any* travel beyond 8 hours.
  // The DC specifically scales with hours *past* 8.
  // Logic:
  // 9 hours -> 1 hour over -> DC 10 + 1 = 11.
  // 8.5 hours -> 0.5 hours over. If we check at the END of the hour, we haven't triggered the DC 11 check yet.
  // We will treat hoursOverLimit as the integer count of full hours past 8.
  // TODO(lint-intent): 'hoursOverLimit' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  const _hoursOverLimit = Math.floor(Math.max(0, hoursTraveled - SAFE_TRAVEL_HOURS));

  // PHB: "The DC is 10 + 1 for each hour of past 8 hours."
  // If we have traveled > 8 hours, it is a forced march.
  // But if hoursOverLimit is 0 (e.g. 8.5 hours), strict reading might imply no check or DC 10.
  // Reviewer feedback implies DC should only increase after a full hour.
  // Let's assume:
  // 8.0 -> Not forced.
  // 8.1 -> Forced. But haven't finished hour 9. So maybe no save yet?
  // "At the end of each hour" -> implies if you stop at 8.5, you didn't finish the 9th hour, so no save.
  // So we only return a valid save DC if hoursOverLimit >= 1.

  const effectiveHoursOver = Math.floor(hoursTraveled - SAFE_TRAVEL_HOURS);
  const requireSave = effectiveHoursOver >= 1;

  // Re-evaluating based on "The DC is 10 + 1 for each hour".
  // Hour 9 (total 9): DC 10 + 1 = 11.
  // Hour 10 (total 10): DC 10 + 2 = 12.

  const constitutionSaveDC = requireSave ? 10 + effectiveHoursOver : 0;

  return {
    isForcedMarch: hoursTraveled > SAFE_TRAVEL_HOURS,
    hoursOverLimit: Math.max(0, hoursTraveled - SAFE_TRAVEL_HOURS), // Keep exact float for display/logic
    constitutionSaveDC,
  };
}

/**
 * Calculates the encumbrance level and effects for a character.
 * Implements "Variant Encumbrance" rules.
 */
export function calculateEncumbrance(
  character: PlayerCharacter,
  inventory: Item[] // The inventory items CARRIED by this specific character
): EncumbranceResult {
  // Calculate total weight
  // Note: Coin weight is often ignored or calculated separately, standard 5e is 50 coins = 1 lb.
  // We'll focus on item weight for now.
  // TODO(lint-intent): quantity is optional on Item; assume 1 when absent so encumbrance math remains conservative.
  const totalWeight = inventory.reduce((sum, item) => sum + (item.weight || 0) * ((item as any).quantity ?? 1), 0);

  const strScore = (character.finalAbilityScores as any).Strength || 10;

  // Thresholds
  const encumberedThreshold = strScore * 5;
  const heavilyEncumberedThreshold = strScore * 10;
  const maxCarry = strScore * 15;

  let level: EncumbranceLevel = 'unencumbered';
  let speedDrop = 0;

  if (totalWeight > heavilyEncumberedThreshold) {
    level = 'heavily_encumbered';
    speedDrop = 20;
  } else if (totalWeight > encumberedThreshold) {
    level = 'encumbered';
    speedDrop = 10;
  }

  return {
    currentWeight: totalWeight,
    maxCarry,
    encumberedThreshold,
    heavilyEncumberedThreshold,
    level,
    speedDrop,
  };
}

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
export function calculateGroupTravelStats(
  characters: PlayerCharacter[],
  inventories: Record<string, Item[]>,
  pace: TravelPace = 'normal',
  terrain: TravelTerrain = 'open',
  transport: TransportOption = { method: 'walking' }
): TravelGroupStats {
  if (characters.length === 0) {
    return {
      slowestMemberId: '',
      baseSpeed: 0,
      travelSpeedMph: 0,
      pace,
      terrain,
      terrainModifier: TERRAIN_TRAVEL_MODIFIERS[terrain],
      dailyDistanceMiles: 0,
      transportMethod: transport.method,
    };
  }

  let minSpeed = Infinity;
  let slowestId = characters[0].id || 'unknown';

  // 1. Determine Base Speed
  if (transport.method === 'walking') {
    // Normal Walking: Limited by slowest member and encumbrance
    for (const char of characters) {
      const charInventory = inventories[char.id || ''] || [];
      const encumbrance = calculateEncumbrance(char, charInventory);

      // Base speed usually 30. Apply encumbrance penalty.
      const effectiveSpeed = Math.max(0, (char.speed || 30) - encumbrance.speedDrop);

      if (effectiveSpeed < minSpeed) {
        minSpeed = effectiveSpeed;
        slowestId = char.id || 'unknown';
      }
    }
  } else if (transport.method === 'mounted' || transport.method === 'vehicle') {
    // Mounted/Vehicle: Speed determined by the vehicle/mount
    // Note: If using a cart/wagon, logic would typically check the puller's capacity.
    // Here we simplify: if a specific vehicle is provided, use its speed.
    // If vehicle speed is 0 (like a cart/wagon), we default back to walking speed logic (assuming beasts move at normal pace).

    if (transport.vehicle && transport.vehicle.speed > 0) {
      minSpeed = transport.vehicle.speed;
      slowestId = transport.vehicle.name; // Attributed to vehicle
    } else {
      // Fallback for carts/wagons without defined puller speed -> assume standard beast speed (often 40-60, but heavily encumbered puller = slow).
      // For simplicity in this iteration, we treat carts/wagons as walking speed (limited by group/beast) unless explicit puller stats are added.
      // If no vehicle provided but method is vehicle, default to 30.
      minSpeed = 30;
      slowestId = 'vehicle_puller';
    }
  }

  // 2. Convert Speed (ft/round) to MPH
  // D&D Rule: Speed / 10 = MPH (roughly)
  // 30 ft => 3 mph
  const baseMph = minSpeed / 10;

  // 3. Apply Pace Modifier
  // TODO(lint-intent): Confirm the ts-expect-error is still needed or align the pace modifiers type contract.
  // TODO(lint-intent): If backward compatibility is required, codify a guard or schema for speedMultiplier.
  // @ts-expect-error - Backward compatibility for types if speedMultiplier was used
  const paceMod = PACE_MODIFIERS[pace].speedModifier || PACE_MODIFIERS[pace].speedMultiplier;

  // 4. Apply Terrain Modifier
  // Water vehicles (rowboat, keelboat) generally ignore land terrain penalties but might have water equivalents.
  // For now, if vehicle type is 'water', we ignore terrain modifiers (or assume terrain provided IS water terrain).
  // If vehicle type is 'land' or 'walking', we apply terrain mod.

  let terrainMod = TERRAIN_TRAVEL_MODIFIERS[terrain];

  if (transport.vehicle?.type === 'water') {
    // Water vehicles ignore "road/difficult" land modifiers usually, unless the terrain IS "rough water".
    // If the input terrain is 'difficult', we assume it means 'rough water' for a boat.
    // If input is 'road', it doesn't make sense for a boat, so we treat as open water (1.0).
    // Simplifying: Apply modifier if it's < 1.0 (difficult), otherwise 1.0.
    terrainMod = terrainMod < 1.0 ? terrainMod : 1.0;
  }

  // 5. Final Calculation
  const travelSpeedMph = baseMph * paceMod * terrainMod;

  // Calculate Daily Distance (8 hours travel)
  const dailyDistanceMiles = travelSpeedMph * 8;

  return {
    slowestMemberId: slowestId,
    baseSpeed: minSpeed,
    travelSpeedMph: Number(travelSpeedMph.toFixed(2)),
    pace,
    terrain,
    terrainModifier: terrainMod,
    dailyDistanceMiles: Number(dailyDistanceMiles.toFixed(2)),
    transportMethod: transport.method,
  };
}

/**
 * Calculates travel time in hours for a given distance.
 */
export function calculateTravelTimeHours(distanceMiles: number, groupStats: TravelGroupStats): number {
  if (groupStats.travelSpeedMph <= 0) return Infinity;
  return distanceMiles / groupStats.travelSpeedMph;
}
