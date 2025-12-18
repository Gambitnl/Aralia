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
