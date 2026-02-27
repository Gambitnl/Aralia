// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:34:38
 * Dependents: travel/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {
  // TODO(lint-intent): 'TravelPace' is declared but unused, suggesting an unfinished state/behavior hook in this block.
  // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
  // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
  TravelPace as _TravelPace,
  TravelParameters,
  TravelResult,
  PACE_MODIFIERS
} from '../../types/travel';

/**
 * Calculates travel metrics based on 5th Edition rules.
 *
 * Standard Rules (PHB):
 * - Normal Pace: 3 miles/hour (300 ft/min), 24 miles/day
 * - Fast Pace: 4 miles/hour (400 ft/min), 30 miles/day (-5 Passive Perception)
 * - Slow Pace: 2 miles/hour (200 ft/min), 18 miles/day (Able to Stealth)
 *
 * Assumption: Base speed of 30ft translates to these standard rates.
 * Creatures with different base speeds scale proportionally.
 */
export class TravelCalculator {

  /**
   * Calculates travel details between two points.
   * Assumes a 1-unit grid corresponds to a specific distance (e.g., 6 miles per hex/tile).
   *
   * @param params Travel parameters
   * @param milesPerTile Distance represented by one grid unit (default 6 miles for province scale)
   */
  static calculateTravel(params: TravelParameters, milesPerTile: number = 6): TravelResult {
    // 1. Calculate Distance
    // Using Chebyshev distance (max(dx, dy)) for 8-way movement on a square grid
    // This approximates diagonal movement cost being similar to cardinal in some systems,
    // or we can use Euclidean.
    // D&D 5e typically uses "5-5-5" (Chebyshev) or "5-10-5" (approx Euclidean).
    // Let's stick to simple Chebyshev for grid movement consistency with many VTTs.
    const dx = Math.abs(params.destination.x - params.origin.x);
    const dy = Math.abs(params.destination.y - params.origin.y);
    const distanceTiles = Math.max(dx, dy);
    const distanceMiles = distanceTiles * milesPerTile;

    // 2. Determine Speed
    // Base 30ft speed = 3 mph normal pace.
    // Speed factor = (Base Speed / 30).
    // TODO(lint-intent): 'speedFactor' is declared but unused, suggesting an unfinished state/behavior hook in this block.
    // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
    // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
    const _speedFactor = params.baseSpeed / 30;

    // Apply Encumbrance (simplified: if encumbered, speed drops by 10ft or similar)
    // For this calculation, we'll assume 'isEncumbered' drops speed by 10ft before scaling.
    // Note: Standard 5e Encumbrance drops speed by 10 or 20 ft. We'll use a 10ft penalty.
    const effectiveBaseSpeed = params.isEncumbered
      ? Math.max(5, params.baseSpeed - 10)
      : params.baseSpeed;

    const adjustedSpeedFactor = effectiveBaseSpeed / 30;

    // Apply Pace
    const paceMod = PACE_MODIFIERS[params.pace];

    // Base normal travel speed is 3 mph for a 30ft speed character.
    const baseMph = 3.0;
    const travelSpeedMph = baseMph * adjustedSpeedFactor * paceMod.speedModifier;

    // 3. Calculate Time
    // Avoid division by zero
    const finalSpeed = Math.max(0.1, travelSpeedMph);
    const travelTimeHours = distanceMiles / finalSpeed;

    // 4. Encounter Checks
    // Standard rule: 1 check per 4 hours? Or per long rest?
    // Let's say 1 check every 4 hours of travel.
    const encounterChecks = Math.ceil(travelTimeHours / 4);

    // TODO: Integrate with event generation system (see src/services/travelEventService.ts) to populate actual encounters based on encounterChecks.

    const terrainUsed = params.terrain ?? 'open';

    return {
      distanceMiles,
      travelTimeHours,
      travelSpeedMph: finalSpeed,
      usedTerrain: terrainUsed,
      encounterChecks
    };
  }
}
