/**
 * @file src/systems/travel/TravelNavigation.ts
 * Logic for "Getting Lost" (Navigation) mechanics.
 *
 * Based on D&D 5e DMG (p. 111) rules for becoming lost.
 */

import {
  TravelPace,
  TravelTerrain,
  NavigationResult,
  TravelDirection,
  PACE_MODIFIERS
} from '../../types/travel';
import { SeededRandom } from '@/utils/random';

// Map difficult terrain subtypes if we had them (e.g. 'forest' -> 15, 'desert' -> 10)
// Since we only have 'difficult' right now, we default to 15 (Standard forest/swamp difficulty).
export const TERRAIN_NAVIGATION_DCS: Record<TravelTerrain, number> = {
  road: 0,
  trail: 0,
  open: 5,
  difficult: 15,
};

const DIRECTIONS: TravelDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * Checks if the party gets lost during travel.
 *
 * @param survivalCheckResult The d20 + Survival Modifier roll result.
 * @param terrain The terrain type being traversed.
 * @param pace The travel pace (affects DC/Roll).
 * @param hasMapOrCompass Whether the party has navigational aids (Advantage -> +5).
 * @param intendedDirection The direction the party WANTS to go.
 * @param rng Optional SeededRandom instance for deterministic drift.
 */
export function checkNavigation(
  survivalCheckResult: number,
  terrain: TravelTerrain,
  pace: TravelPace,
  hasMapOrCompass: boolean,
  intendedDirection: TravelDirection,
  rng: SeededRandom = new SeededRandom(Math.random())
): NavigationResult {

  // 1. Determine DC
  const dc = TERRAIN_NAVIGATION_DCS[terrain];

  // If DC is 0, auto-success (following a road)
  if (dc === 0) {
    return {
      success: true,
      dc,
      roll: survivalCheckResult, // Irrelevant but tracked
      driftDirection: null,
      timePenaltyHours: 0
    };
  }

  // 2. Apply Modifiers to the ROLL (or DC).
  // Standard 5e: Slow pace = +5 to roll. Fast pace = -5 to passive perception (and often navigation penalty).
  // We defined `navigationModifier` in PACE_MODIFIERS.
  const paceMod = PACE_MODIFIERS[pace].navigationModifier;

  // Map/Compass grants Advantage (+5 equivalent in passive/static checks)
  const mapMod = hasMapOrCompass ? 5 : 0;

  const finalRoll = survivalCheckResult + paceMod + mapMod;

  // 3. Determine Outcome
  const success = finalRoll >= dc;

  if (success) {
    return {
      success: true,
      dc,
      roll: finalRoll,
      driftDirection: null,
      timePenaltyHours: 0
    };
  } else {
    // 4. Handle Failure (Getting Lost)
    // DMG: "The party's navigator rolls a d6 and consults the table to determine the actual direction of travel."
    // d6 implies hex grid logic often, or 1d8 for square grid.
    // We will use 1d8 to pick a random direction that IS NOT the intended one.

    // Pick a random drift direction
    let drift = intendedDirection;
    // Ensure we don't pick the intended direction (otherwise they aren't really lost effectively)
    // Although technically you *could* wander in the right direction by accident, but usually 'Lost' means 'Off course'.
    while (drift === intendedDirection) {
        drift = rng.pick(DIRECTIONS);
    }

    // Time Penalty: 1d6 hours before realizing/correcting?
    // DMG says they travel in that direction for 1d6 hours before checking again.
    const timePenalty = rng.nextInt(1, 6);

    return {
      success: false,
      dc,
      roll: finalRoll,
      driftDirection: drift,
      timePenaltyHours: timePenalty
    };
  }
}

// TODO(Navigator): Integrate checkNavigation into the main travel event loop in handleMovement.ts or TravelService to apply drift results.
