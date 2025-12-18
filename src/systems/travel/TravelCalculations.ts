/**
 * @file src/systems/travel/TravelCalculations.ts
 * Core calculations for travel, pace, and encumbrance.
 *
 * Implements 5e-style travel rules:
 * - Pace: Slow (Stealth), Normal, Fast (Penalty).
 * - Encumbrance: Variant encumbrance rules affecting speed.
 * - Group Speed: Limited by the slowest member.
 */

import { PlayerCharacter } from '../../types/character';
import { Item } from '../../types/items';

// --- Types ---

export type TravelPace = 'slow' | 'normal' | 'fast';

export interface PaceEffect {
  speedMultiplier: number;
  canStealth: boolean;
  passivePerceptionModifier: number;
  description: string;
}

export const PACE_MODIFIERS: Record<TravelPace, PaceEffect> = {
  slow: {
    speedMultiplier: 0.67, // ~2/3 speed
    canStealth: true,
    passivePerceptionModifier: 5, // Bonus to passive perception? Or can use stealth. 5e rules: Able to use stealth.
    description: "Move stealthily. Capable of tracking and foraging.",
  },
  normal: {
    speedMultiplier: 1.0,
    canStealth: false,
    passivePerceptionModifier: 0,
    description: "Standard travel speed.",
  },
  fast: {
    speedMultiplier: 1.33, // ~4/3 speed
    canStealth: false,
    passivePerceptionModifier: -5,
    description: "Hasty travel. -5 to Passive Perception.",
  },
};

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
  travelSpeedMph: number; // Effective MPH including pace
  pace: TravelPace;
  dailyDistanceMiles: number; // Assuming 8 hours
}

export interface TravelResult {
  distanceMiles: number;
  travelTimeHours: number;
  travelSpeedMph: number;
  encounterChecks: number;
  // Future: terrainModifier, weatherModifier, etc.
}

export interface Coordinate {
  x: number;
  y: number;
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
  const totalWeight = inventory.reduce((sum, item) => sum + (item.weight || 0), 0);

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
 */
export function calculateGroupTravelStats(
  characters: PlayerCharacter[],
  inventories: Record<string, Item[]>,
  pace: TravelPace = 'normal'
): TravelGroupStats {
  if (characters.length === 0) {
    return {
      slowestMemberId: '',
      baseSpeed: 0,
      travelSpeedMph: 0,
      pace,
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
  const paceMod = PACE_MODIFIERS[pace].speedMultiplier;
  const travelSpeedMph = baseMph * paceMod;

  // Calculate Daily Distance (8 hours travel)
  const dailyDistanceMiles = travelSpeedMph * 8;

  return {
    slowestMemberId: slowestId,
    baseSpeed: minSpeed,
    travelSpeedMph: Number(travelSpeedMph.toFixed(2)),
    pace,
    dailyDistanceMiles: Number(dailyDistanceMiles.toFixed(2)),
  };
}

/**
 * Calculates grid distance in miles.
 * Uses Chebyshev distance (max(dx, dy)) for 8-way movement.
 */
export function calculateDistanceMiles(
  origin: Coordinate,
  destination: Coordinate,
  milesPerTile: number = 6
): number {
  const dx = Math.abs(destination.x - origin.x);
  const dy = Math.abs(destination.y - origin.y);
  const distanceTiles = Math.max(dx, dy);
  return distanceTiles * milesPerTile;
}

/**
 * Calculates full travel results including time and encounter checks.
 *
 * @param distanceMiles Distance to travel
 * @param groupStats Pre-calculated group stats
 * @param terrainCostModifier Multiplier for terrain difficulty (default 1.0 = normal)
 */
export function calculateTravelResult(
  distanceMiles: number,
  groupStats: TravelGroupStats,
  terrainCostModifier: number = 1.0
): TravelResult {
  // Prevent division by zero
  const effectiveSpeed = Math.max(0.1, groupStats.travelSpeedMph);

  // Calculate raw time
  let travelTimeHours = distanceMiles / effectiveSpeed;

  // Apply terrain modifier (e.g., 2.0 = difficult terrain takes 2x time)
  travelTimeHours *= terrainCostModifier;

  // Encounter checks: 1 check every 4 hours
  const encounterChecks = Math.ceil(travelTimeHours / 4);

  return {
    distanceMiles,
    travelTimeHours,
    travelSpeedMph: effectiveSpeed,
    encounterChecks,
  };
}
