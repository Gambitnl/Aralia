// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026, 13:54:43
 * Dependents: utils/character/characterUtils.ts, utils/character/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file calculates how much weight a character can carry, lift, or drag,
 * and determines if they are slowed down by carrying too much gear.
 *
 * It uses the character's Strength score and size (Small, Medium, Large, etc.)
 * along with racial traits like Powerful Build (which lets characters carry
 * as if they were one size larger) to calculate weight thresholds.
 *
 * Called by: Inventory UI, character sheets, movement resolvers, and characterUtils facade.
 * Depends on: calculateCarryingCapacity from combat/physicsUtils.
 */

import { PlayerCharacter } from '../../types';
import { calculateCarryingCapacity } from '../combat/physicsUtils';

// ============================================================================
// Types and Constants
// ============================================================================
// Multipliers for carrying capacity based on creature size category according
// to standard 5e rules (Tiny creatures carry half, Large double, etc.).
// ============================================================================

/**
 * 5e carrying-capacity size multipliers per size category (PHB: Tiny 0.5,
 * Small/Medium 1, Large 2, Huge 4, Gargantuan 8). Distinct from the grid
 * occupancy multiplier in combat (Large 2, Huge 3, Gargantuan 4).
 */
export const CARRYING_SIZE_MULTIPLIERS: Record<string, number> = {
  Tiny: 0.5,
  Small: 1,
  Medium: 1,
  Large: 2,
  Huge: 4,
  Gargantuan: 8,
};

/** Carrying capacity result for a character, including 5e-variant thresholds. */
export interface CharacterCarryingCapacity {
  /** Total carry weight in lbs (STR × 15, times size/Powerful Build multiplier). */
  carryingCapacity: number;
  /** Push, drag, or lift limit in lbs (= carryingCapacity × 2). */
  pushDragLift: number;
  /** Base carrying multiplier from the character's size category. */
  sizeMultiplier: number;
  /** Effective multiplier after Powerful Build ("count as one size larger"). */
  effectiveMultiplier: number;
  /** 5e variant encumbrance thresholds in lbs (light/medium/heavy). */
  encumbrance: { light: number; medium: number; heavy: number };
}

export type EncumbranceLevel = 'none' | 'light' | 'medium' | 'heavy';

// ============================================================================
// Carrying Capacity Calculations
// ============================================================================
// Functions to calculate carry limits and evaluate current carried weight against
// variant encumbrance tiers.
// ============================================================================

/**
 * Computes a character's carrying capacity, push/drag/lift, and the 5e variant
 * encumbrance thresholds, honoring the Powerful Build racial trait (GG-6).
 *
 * Powerful Build makes the creature "count as one size larger when determining
 * your carrying capacity and the weight you can push, drag, or lift", so its
 * effect is a doubling of the effective carrying multiplier. All three variant
 * thresholds scale with that effective multiplier (the standard rule treats
 * them as fractions of carrying capacity): light = 1/3, medium = 2/3, heavy =
 * full. This keeps Powerful Build's mechanical impact on inventory real.
 *
 * @param character - The character whose capacity to compute.
 * @returns Carrying capacity result; defaults to Medium, multiplier 1 when size
 *   is unknown and STR 10 when ability scores are absent.
 */
export function calculateCharacterCarryingCapacity(character: PlayerCharacter): CharacterCarryingCapacity {
  // Use final strength if available (including item boosts/overrides), fallback to base score or default 10.
  const strength =
    character.finalAbilityScores?.Strength ?? character.abilityScores?.Strength ?? 10;
  
  // Look up size category; default to standard Medium creature size.
  const size = character.ageSizeOverride ?? 'Medium';
  const sizeMultiplier = CARRYING_SIZE_MULTIPLIERS[size] ?? 1;
  const powerfulBuild = character.modifiers?.powerfulBuild ?? false;

  // Powerful Build counts as one size larger -> carry one step up, i.e. double.
  const effectiveMultiplier = powerfulBuild ? sizeMultiplier * 2 : sizeMultiplier;

  // Calculate standard carry and push/drag/lift capacities from base physics utility.
  const { carryingCapacity, pushDragLift } = calculateCarryingCapacity(strength, effectiveMultiplier);

  // Return the full capacity breakdown with variant encumbrance thresholds.
  return {
    carryingCapacity,
    pushDragLift,
    sizeMultiplier,
    effectiveMultiplier,
    encumbrance: {
      light: carryingCapacity / 3,
      medium: (carryingCapacity * 2) / 3,
      heavy: carryingCapacity,
    },
  };
}

/**
 * Classifies a carried weight against the 5e variant encumbrance thresholds for
 * a character (GG-6). Returns the level and thresholds used, so callers can
 * display or gate behavior (e.g. speed) on the result.
 *
 * @param character - The character carrying items.
 * @param carriedWeightLbs - Total weight of carried items in pounds.
 * @returns Object with the encumbrance tier ('none', 'light', 'medium', 'heavy') and the capacity details.
 */
export function getCharacterEncumbrance(
  character: PlayerCharacter,
  carriedWeightLbs: number
): { level: EncumbranceLevel; carrying: CharacterCarryingCapacity } {
  const carrying = calculateCharacterCarryingCapacity(character);
  const { light, medium, heavy } = carrying.encumbrance;
  let level: EncumbranceLevel = 'none';

  // Compare carried weight to variant thresholds in descending order.
  if (carriedWeightLbs > heavy) {
    level = 'heavy';
  } else if (carriedWeightLbs > medium) {
    level = 'medium';
  } else if (carriedWeightLbs > light) {
    level = 'light';
  }

  return { level, carrying };
}
