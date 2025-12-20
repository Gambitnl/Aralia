/**
 * @file src/systems/travel/TravelCalculations.ts
 * Core calculations for travel, pace, and encumbrance.
 *
 * Implements 5e-style travel rules:
 * - Pace: Slow (Stealth), Normal, Fast (Penalty).
 * - Encumbrance: Variant encumbrance rules affecting speed.
 * - Group Speed: Limited by the slowest member.
 * - Terrain: Difficult terrain halves speed.
 */

import { PlayerCharacter } from '../../types/character';
import { Item } from '../../types/items';
import { TravelPace, TravelTerrain, PACE_MODIFIERS, TERRAIN_TRAVEL_MODIFIERS } from '../../types/travel';

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
}

// --- Calculations ---

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
  const totalWeight = inventory.reduce((sum, item) => sum + (item.weight || 0) * (item.quantity || 1), 0);

  const strScore = character.finalAbilityScores.strength || 10;

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
 * The group moves at the speed of its slowest member.
 *
 * @param characters List of characters in the travel group
 * @param inventories Map of character ID to their specific inventory items
 * @param pace Selected travel pace
 * @param terrain Terrain type (affects speed multiplier)
 */
export function calculateGroupTravelStats(
  characters: PlayerCharacter[],
  inventories: Record<string, Item[]>,
  pace: TravelPace = 'normal',
  terrain: TravelTerrain = 'open'
): TravelGroupStats {
  if (characters.length === 0) {
    return {
      slowestMemberId: '',
      baseSpeed: 0,
      travelSpeedMph: 0,
      pace,
      terrain,
      terrainModifier: 1.0,
      dailyDistanceMiles: 0,
    };
  }

  // Find slowest member
  let minSpeed = Infinity;
  let slowestId = characters[0].id || 'unknown';

  for (const char of characters) {
    const charInventory = inventories[char.id || ''] || [];
    const encumbrance = calculateEncumbrance(char, charInventory);

    // Base speed usually 30. Apply encumbrance penalty.
    // Ensure speed doesn't drop below 0.
    const effectiveSpeed = Math.max(0, (char.speed || 30) - encumbrance.speedDrop);

    if (effectiveSpeed < minSpeed) {
      minSpeed = effectiveSpeed;
      slowestId = char.id || 'unknown';
    }
  }

  // Convert Speed (ft/round) to MPH
  // D&D Rule: Speed / 10 = MPH (roughly)
  // 30 ft => 3 mph
  const baseMph = minSpeed / 10;

  // Apply Pace Modifier
  // @ts-ignore - Backward compatibility for types if speedMultiplier was used
  const paceMod = PACE_MODIFIERS[pace].speedModifier || PACE_MODIFIERS[pace].speedMultiplier;

  // Apply Terrain Modifier
  const terrainMod = TERRAIN_TRAVEL_MODIFIERS[terrain];

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
  };
}

/**
 * Calculates travel time in hours for a given distance.
 */
export function calculateTravelTimeHours(distanceMiles: number, groupStats: TravelGroupStats): number {
  if (groupStats.travelSpeedMph <= 0) return Infinity;
  return distanceMiles / groupStats.travelSpeedMph;
}
