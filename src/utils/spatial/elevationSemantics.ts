// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026, 18:57:15
 * Dependents: commands/factory/AbilityCommandFactory.ts, systems/combat/fallingGroundImpactResolution.ts, utils/spatial/pathfinding.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file turns raw terrain heights into referee facts a character can act on.
 *
 * The geometry ruler (elevationGeometry.ts) already measures how HIGH terrain
 * is and what a height boundary COSTS. This layer answers the remaining G14
 * questions the planmap topic `combat-elevation` tracks: which height steps a
 * walker may simply take, which ones count as climbing, which ones are cliff
 * faces no walk may cross, and when one combatant holds high ground over
 * another.
 *
 * Called by: battle-map pathfinding (walk legality per step) and future
 * attack-roll consumers of the high-ground rule.
 * Depends on: the shared elevation ruler and production battle-map tiles.
 */

import type { BattleMapTile } from '../../types/combat';
import { getBattleMapTileAltitudeFeet } from './elevationGeometry';

// ============================================================================
// Step Classification Thresholds
// ============================================================================
// One five-foot contour per tactical square is a stair (flat). Two contours in
// a single five-foot step is steep enough that walking it IS climbing (slope).
// Anything taller is a cliff face: ascending it needs the Climb action, and
// stepping off it is a fall owned by fallingGroundImpactResolution, never a
// legal walk. Thresholds are whole feet because the ruler rounds to feet.
// ============================================================================

/** Maximum rise/drop, in feet, treated as ordinary walking. */
export const FLAT_STEP_MAX_RISE_FEET = 5;
/** Maximum rise/drop, in feet, walkable while counting as climbing. */
export const SLOPE_STEP_MAX_RISE_FEET = 10;

export type ElevationStepKind = 'flat' | 'slope' | 'cliff';

export interface ElevationStepAssessment {
  /** Referee classification of this five-foot step. */
  kind: ElevationStepKind;
  /** Upward change in surface height, in whole feet (0 when descending). */
  riseFeet: number;
  /** Downward change in surface height, in whole feet (0 when ascending). */
  dropFeet: number;
  /** True when taking this step counts as climbing for cost purposes. */
  requiresClimb: boolean;
  /** True when walking movement may never take this step. */
  blocksWalking: boolean;
}

/**
 * Classifies one five-foot step between neighbouring tiles.
 *
 * Both ascent and descent are assessed symmetrically except for the climb
 * flag: a slope ascent is climbing, while a slope descent remains a
 * controlled walk that merely pays its vertical feet through the existing
 * transition-cost rule.
 */
export function assessElevationStep(
  fromTile: Pick<BattleMapTile, 'elevation'>,
  toTile: Pick<BattleMapTile, 'elevation'>,
): ElevationStepAssessment {
  const deltaFeet =
    getBattleMapTileAltitudeFeet(toTile) - getBattleMapTileAltitudeFeet(fromTile);
  const riseFeet = Math.max(0, deltaFeet);
  const dropFeet = Math.max(0, -deltaFeet);
  const magnitudeFeet = Math.max(riseFeet, dropFeet);

  let kind: ElevationStepKind;
  if (magnitudeFeet <= FLAT_STEP_MAX_RISE_FEET) {
    kind = 'flat';
  } else if (magnitudeFeet <= SLOPE_STEP_MAX_RISE_FEET) {
    kind = 'slope';
  } else {
    kind = 'cliff';
  }

  return {
    kind,
    riseFeet,
    dropFeet,
    requiresClimb: kind === 'slope' && riseFeet > 0,
    blocksWalking: kind === 'cliff',
  };
}

// ============================================================================
// High Ground
// ============================================================================
// Aralia house rule recorded for the `combat-elevation` topic: a melee
// combatant whose feet sit at least one full height band above their target's
// presses the attack downhill (Advantage), and one fighting uphill from below
// suffers Disadvantage. This is deliberately exposed as a pure fact for the
// combat engine to adopt at its own attack-roll site; nothing consumes it yet,
// so behaviour is unchanged until that wiring lands.
// ============================================================================

/** Minimum altitude advantage, in feet, before high ground applies. */
export const HIGH_GROUND_THRESHOLD_FEET = 5;

export type HighGroundModifier = 'advantage' | 'disadvantage' | null;

export interface HighGroundAssessment {
  modifier: HighGroundModifier;
  /** Attacker altitude minus target altitude, in whole feet. */
  deltaFeet: number;
}

export function getHighGroundAdvantage(
  attackerAltitudeFeet: number,
  targetAltitudeFeet: number,
): HighGroundAssessment {
  const deltaFeet = attackerAltitudeFeet - targetAltitudeFeet;
  return {
    deltaFeet,
    modifier:
      deltaFeet >= HIGH_GROUND_THRESHOLD_FEET
        ? 'advantage'
        : deltaFeet <= -HIGH_GROUND_THRESHOLD_FEET
          ? 'disadvantage'
          : null,
  };
}

// ============================================================================
// Voluntary Descent
// ============================================================================
// Walking off a cliff face is never legal movement, so a walker attempting an
// edge step should enter the canonical fall transaction instead. This fact
// classifies one attempted step-down for that handoff. A climbing character
// descending under control bypasses this bridge entirely and stays in
// ordinary pathfinding per the referee contract above.
// ============================================================================

export interface VoluntaryDescentAssessment {
  /** True when the step stays ordinary walking and no fall event applies. */
  walkableWithoutFalling: boolean;
  /** Vertical feet a deliberate edge step converts into fall distance. */
  fallDistanceFeet: number;
}

export function assessVoluntaryDescent(
  fromTile: Pick<BattleMapTile, 'elevation'>,
  toTile: Pick<BattleMapTile, 'elevation'>,
): VoluntaryDescentAssessment {
  const step = assessElevationStep(fromTile, toTile);
  return {
    walkableWithoutFalling: !step.blocksWalking,
    fallDistanceFeet: step.blocksWalking ? step.dropFeet : 0,
  };
}