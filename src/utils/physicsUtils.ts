/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/utils/physicsUtils.ts
 * Core physics and mechanical rule calculations for D&D 5e / 2024.
 * Defines predictable formulas for falling, jumping, lifting, and throwing.
 */

import { DamageType } from '../types/spells';

/**
 * Represents a dice roll formula (e.g., 3d6).
 */
export interface DiceRoll {
  dice: number;
  sides: number;
  type: DamageType;
}

/**
 * Calculates falling damage per PHB 2024 rules.
 * Rule: 1d6 bludgeoning damage for every 10 feet fallen, to a maximum of 20d6.
 *
 * @param distanceFeet - The distance fallen in feet.
 * @returns The dice roll for damage (e.g., 3d6 Bludgeoning).
 */
export function calculateFallDamage(distanceFeet: number): DiceRoll {
  // Edge case: Negative distance or negligible fall
  if (distanceFeet < 10) {
    return { dice: 0, sides: 6, type: 'Bludgeoning' };
  }

  // 1d6 per 10 feet
  const d6Count = Math.floor(distanceFeet / 10);

  // Cap at 20d6 (200 feet)
  const finalCount = Math.min(20, d6Count);

  return { dice: finalCount, sides: 6, type: 'Bludgeoning' };
}

/**
 * Calculates the maximum carrying capacity in pounds.
 * Rule (PHB 2014/2024): Strength score * 15.
 *
 * @param strength - The character's Strength score.
 * @param sizeMultiplier - Multiplier for creature size (Tiny=0.5, Large=2, Huge=4, Gargantuan=8). Default 1 (Medium/Small).
 * @returns Carrying capacity in pounds.
 */
export function calculateCarryingCapacity(strength: number, sizeMultiplier: number = 1): number {
  return strength * 15 * sizeMultiplier;
}

/**
 * Calculates the push, drag, and lift capacity in pounds.
 * Rule (PHB 2014/2024): Carrying Capacity * 2 (or Strength * 30).
 * While pushing/dragging in excess of carrying capacity, speed drops to 5 ft.
 *
 * @param strength - The character's Strength score.
 * @param sizeMultiplier - Multiplier for creature size.
 * @returns Push/Drag/Lift capacity in pounds.
 */
export function calculatePushDragLiftCapacity(strength: number, sizeMultiplier: number = 1): number {
  return calculateCarryingCapacity(strength, sizeMultiplier) * 2;
}

/**
 * Calculates maximum long jump distance (PHB 2014 Rules).
 * Rule: Distance equals Strength score if moving at least 10 feet immediately before.
 * Half distance if standing.
 *
 * @param strength - The character's Strength score.
 * @param hasRunningStart - Whether the character moved at least 10 feet before jumping.
 * @returns Maximum jump distance in feet.
 */
export function calculateLongJumpDistance(strength: number, hasRunningStart: boolean): number {
  const baseDistance = strength;
  return hasRunningStart ? baseDistance : Math.floor(baseDistance / 2);
}

/**
 * Calculates maximum high jump height (PHB 2014 Rules).
 * Rule: 3 + Strength Modifier if moving at least 10 feet.
 * Half height if standing.
 *
 * @param strengthModifier - The character's Strength modifier (e.g., +3).
 * @param hasRunningStart - Whether the character moved at least 10 feet before jumping.
 * @returns Maximum jump height in feet.
 */
export function calculateHighJumpHeight(strengthModifier: number, hasRunningStart: boolean): number {
  // Minimum 0 for modifier math (though mechanics usually floor at <1 total, logic here preserves formula)
  const baseHeight = 3 + strengthModifier;
  // D&D minimum is usually 0, but a negative mod could technically result in <0. Clamping to 0.
  const effectiveHeight = Math.max(0, baseHeight);

  return hasRunningStart ? effectiveHeight : Math.floor(effectiveHeight / 2);
}

/**
 * Calculates throwing distance for improvised objects.
 * D&D 5e simplified: STR * 10 feet, weight penalty after 5 lbs.
 * Note: Thrown weapons use their own range properties (20/60 etc).
 *
 * @param strength - Character's Strength score (1-30).
 * @param objectWeight - Weight of the object in pounds.
 * @returns Distance in feet.
 */
export function calculateThrowDistance(
  strength: number,
  objectWeight: number
): number {
  // Base distance
  const baseDist = strength * 10;

  // Penalty: 5 feet reduction for every 10 lbs over 5 lbs?
  // Prompt formula: "weight penalty after 5 lbs" -> (weight - 5) / 10 * 5
  // Example: 15 lbs -> (10 / 10) * 5 = 5 ft penalty.
  const weightExcess = Math.max(0, objectWeight - 5);
  const penaltySteps = Math.floor(weightExcess / 10);
  const weightPenalty = penaltySteps * 5;

  // Minimum distance of 5 feet if you can lift it
  return Math.max(5, baseDist - weightPenalty);
}

// TODO(Mechanist): Integrate calculateFallDamage into the MovementCommand or TurnManager to apply damage on large vertical drops.
