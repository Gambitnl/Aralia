/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/utils/physicsUtils.ts
 * Physical rule calculations for the game world.
 * Implements mechanics for movement, falling, and object interactions based on D&D 5e rules.
 */

import { DiceRoll } from '../types/dice';
import { Position } from '../types/combat';

// TODO(Mechanist): Integrate object AC/HP rules into combat targeting system (attacking doors/walls).
// TODO(Mechanist): Wire up suffocation/breath rules into `useTurnManager.ts` to apply StatusEffect.Choking when breath runs out.
export type ObjectSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
export type ObjectMaterial = 'cloth' | 'paper' | 'rope' | 'crystal' | 'glass' | 'ice' | 'wood' | 'bone' | 'stone' | 'iron' | 'steel' | 'mithral' | 'adamantine';

export type LightLevel = 'bright' | 'dim' | 'darkness';

/**
 * Gets the Armor Class (AC) of an object based on its material.
 * D&D 5e DMG pg 246.
 *
 * @param material - The material the object is made of.
 * @returns The Armor Class.
 */
export function getObjectAC(material: ObjectMaterial): number {
  switch (material) {
    case 'cloth':
    case 'paper':
    case 'rope':
      return 11;
    case 'crystal':
    case 'glass':
    case 'ice':
      return 13;
    case 'wood':
    case 'bone':
      return 15;
    case 'stone':
      return 17;
    case 'iron':
    case 'steel':
      return 19;
    case 'mithral':
      return 21;
    case 'adamantine':
      return 23;
    default:
      return 10; // Fallback
  }
}

/**
 * Gets the Hit Points (HP) formula for an object based on size and fragility.
 * D&D 5e DMG pg 247.
 *
 * @param size - The size of the object (Tiny to Large+).
 * @param isFragile - Whether the object is fragile (e.g. glass) or resilient (e.g. wood/stone).
 * @returns A DiceRoll representing the object's HP formula.
 */
export function getObjectHP(size: ObjectSize, isFragile: boolean = false): DiceRoll {
  // DMG p. 247 "Object Hit Points" Table
  switch (size) {
    case 'tiny':
      // Fragile: 2 (1d4), Resilient: 5 (2d4)
      return { dice: isFragile ? 1 : 2, sides: 4, type: 'bludgeoning' }; // Damage type is placeholder
    case 'small':
      // Fragile: 3 (1d6), Resilient: 10 (3d6)
      return { dice: isFragile ? 1 : 3, sides: 6, type: 'bludgeoning' };
    case 'medium':
      // Fragile: 4 (1d8), Resilient: 18 (4d8)
      return { dice: isFragile ? 1 : 4, sides: 8, type: 'bludgeoning' };
    case 'large':
    case 'huge':
    case 'gargantuan':
      // Fragile: 5 (1d10), Resilient: 27 (5d10)
      // Note: Huge/Gargantuan usually treated as multiple Large sections or custom HP
      return { dice: isFragile ? 1 : 5, sides: 10, type: 'bludgeoning' };
    default:
       return { dice: 1, sides: 4, type: 'bludgeoning' };
  }
}

/**
 * Calculates falling damage per PHB 2024.
 * 1d6 bludgeoning damage for every 10 feet fallen, to a maximum of 20d6.
 * The creature lands prone unless they avoid taking damage.
 *
 * @param distanceFeet - The distance fallen in feet.
 * @returns A DiceRoll object representing the damage to roll (e.g., { dice: 3, sides: 6 }).
 */
export function calculateFallDamage(distanceFeet: number): DiceRoll {
  // Rule: 1d6 per 10 feet
  const d6Count = Math.floor(distanceFeet / 10);

  // Rule: Maximum of 20d6
  const finalDiceCount = Math.min(20, d6Count);

  return {
    dice: finalDiceCount,
    sides: 6,
    type: 'bludgeoning',
  };
}

/**
 * Calculates the jump distance for a character based on Strength and movement type.
 *
 * @param strengthScore - The character's Strength score (1-30).
 * @param type - 'long' for Long Jump, 'high' for High Jump.
 * @param standing - Whether the jump is a standing jump (no 10ft run-up).
 * @returns The distance/height in feet.
 */
export function calculateJumpDistance(
  strengthScore: number,
  type: 'long' | 'high',
  standing: boolean = false
): number {
  let distance = 0;

  if (type === 'long') {
    // PHB: Long Jump covers a number of feet equal to your Strength score.
    distance = strengthScore;
  } else {
    // PHB: High Jump reaches a height equal to 3 + your Strength modifier.
    const strengthMod = Math.floor((strengthScore - 10) / 2);
    distance = 3 + strengthMod;

    // Minimum high jump logic (no negative jumps)
    if (distance < 0) distance = 0;
  }

  // PHB: When you make a standing long/high jump, you can jump only half that distance.
  if (standing) {
    distance = Math.floor(distance / 2);
  }

  return distance;
}

/**
 * Calculates the carrying capacity and encumbrance thresholds.
 *
 * @param strengthScore - The character's Strength score.
 * @param sizeMultiplier - Multiplier for creature size (Tiny=0.5, Med=1, Large=2, Huge=4, Garg=8).
 * @returns Object containing capacity in pounds.
 */
export function calculateCarryingCapacity(
  strengthScore: number,
  sizeMultiplier: number = 1
): { carryingCapacity: number; pushDragLift: number } {
  // PHB: Carrying Capacity = Strength score * 15
  const carryingCapacity = strengthScore * 15 * sizeMultiplier;

  // PHB: Push, Drag, or Lift = Carrying Capacity * 2 (or Strength * 30)
  const pushDragLift = carryingCapacity * 2;

  return { carryingCapacity, pushDragLift };
}

/**
 * Calculates how long a creature can hold its breath.
 * PHB 2014/2024: 1 + Constitution Modifier minutes (minimum 30 seconds).
 *
 * @param conMod - The creature's Constitution modifier.
 * @returns The duration in minutes.
 */
export function calculateBreathDuration(conMod: number): number {
  // Rule: 1 + Con Mod minutes
  const minutes = 1 + conMod;

  // Rule: Minimum of 30 seconds (0.5 minutes)
  return Math.max(0.5, minutes);
}

/**
 * Calculates how long a creature can survive after running out of breath (choking).
 * PHB 2014/2024: Equal to Constitution modifier rounds (minimum 1 round).
 * At the start of its next turn after these rounds, it drops to 0 HP.
 *
 * @param conMod - The creature's Constitution modifier.
 * @returns The duration in rounds (6 seconds each).
 */
export function calculateSuffocationRounds(conMod: number): number {
  // Rule: Rounds equal to Con Mod
  // Rule: Minimum of 1 round
  return Math.max(1, conMod);
}

// TODO(Mechanist): Wire up throw distance calculation to the 'Throw' item action in useInventoryAction.ts.
/**
 * Calculates throwing distance based on Strength.
 * D&D 5e simplified: STR * 10 feet, weight penalty after 5 lbs.
 *
 * @param strength - Character's Strength score (1-30).
 * @param objectWeight - Weight in pounds.
 * @returns Distance in feet.
 */
export function calculateThrowDistance(
  strength: number,
  objectWeight: number
): number {
  // Base range: Strength * 10 feet
  const baseDist = strength * 10;

  // Weight penalty: -5 feet for every 10 lbs over 5 lbs
  // (e.g. 15 lbs = (15-5)/10 = 1 * 5 = 5 ft penalty)
  const weightPenalty = Math.max(0, Math.floor((objectWeight - 5) / 10)) * 5;

  // Minimum distance of 5 feet
  return Math.max(5, baseDist - weightPenalty);
}

/**
 * Calculates the Chebyshev distance between two grid positions (5-5-5 rule).
 * In D&D 5e grid rules, diagonal movement costs the same as cardinal movement (unless using variant rules).
 * This means distance is effectively `max(dx, dy) * 5`.
 *
 * @param a - First position.
 * @param b - Second position.
 * @returns Distance in feet (assuming 5ft grid).
 */
export function calculateChebyshevDistance(a: Position, b: Position): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) * 5;
}

// TODO(Mechanist): Integrate `calculateLightLevel` into `BattleMap` rendering to dynamically visualize Fog of War.
/**
 * Calculates the light level at a specific target position relative to a light source.
 * D&D 5e Rules (PHB p. 183):
 * - Bright light: Within the defined bright radius.
 * - Dim light: Between the bright radius and the end of the dim radius.
 * - Darkness: Beyond the dim radius.
 *
 * @param target - The position to check for illumination.
 * @param sourceOrigin - The origin of the light source.
 * @param brightRadius - The radius of bright light in feet.
 * @param dimRadius - The *additional* radius of dim light beyond bright light (e.g., Torch: 20 bright, 20 dim).
 * @returns 'bright', 'dim', or 'darkness'.
 */
export function calculateLightLevel(
  target: Position,
  sourceOrigin: Position,
  brightRadius: number,
  dimRadius: number
): LightLevel {
  const distance = calculateChebyshevDistance(target, sourceOrigin);

  if (distance <= brightRadius) {
    return 'bright';
  } else if (distance <= brightRadius + dimRadius) {
    return 'dim';
  } else {
    return 'darkness';
  }
}

/**
 * Determines the effective light level at a position given multiple light sources.
 * - Bright light overrides Dim light and Darkness.
 * - Dim light overrides Darkness.
 *
 * @param target - The position to check.
 * @param sources - A list of light sources with their resolved positions.
 * @returns The highest level of illumination present.
 */
export function getCombinedLightLevel(
  target: Position,
  sources: { position: Position; brightRadius: number; dimRadius: number }[]
): LightLevel {
  let hasDim = false;

  for (const source of sources) {
    const level = calculateLightLevel(target, source.position, source.brightRadius, source.dimRadius);
    if (level === 'bright') {
      return 'bright'; // Maximum illumination reached
    }
    if (level === 'dim') {
      hasDim = true;
    }
  }

  return hasDim ? 'dim' : 'darkness';
}
