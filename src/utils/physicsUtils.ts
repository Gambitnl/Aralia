/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/utils/physicsUtils.ts
 * Physical rule calculations for the game world.
 * Implements mechanics for movement, falling, and object interactions based on D&D 5e rules.
 */

import { DiceRoll } from '../types/dice';

// Using string for DamageType to avoid circular dependency or import issues if enum is not available
type DamageType = 'bludgeoning' | 'acid' | 'cold' | 'fire' | 'force' | 'lightning' | 'necrotic' | 'piercing' | 'poison' | 'psychic' | 'radiant' | 'slashing' | 'thunder';

// TODO(Mechanist): Integrate object AC/HP rules into combat targeting system (attacking doors/walls).
export type ObjectSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';
export type ObjectMaterial = 'cloth' | 'paper' | 'rope' | 'crystal' | 'glass' | 'ice' | 'wood' | 'bone' | 'stone' | 'iron' | 'steel' | 'mithral' | 'adamantine';

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
