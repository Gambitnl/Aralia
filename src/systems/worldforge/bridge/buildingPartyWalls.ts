// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 14/07/2026, 21:20:02
 * Dependents: systems/worldforge/bridge/buildingHistoryParts.ts, systems/worldforge/bridge/buildingMaterialParts.ts, systems/worldforge/bridge/buildingWeatheringParts.ts, systems/worldforge/bridge/interiorParts.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file answers whether one exterior wall run belongs to a neighboring
 * row building for visible presentation.
 *
 * Every attached building retains its complete structural wall for rooms,
 * navigation, and combat. The town's ensemble receipt chooses which frontage
 * member visibly owns the seam. Material courses, weathering, facade trim, and
 * wall history all call this helper so they cannot disagree about that owner.
 *
 * Called by: run-driven Worldforge bridge dressing modules
 * Depends on: BlueprintPlan ensemble identity and canonical wall normals
 */

import type { BlueprintPlan, WallRun } from '../interior/blueprintTypes';

// ============================================================================
// Shared Ownership Predicate
// ============================================================================

/** True when this building keeps the run tactically but its neighbor renders it. */
export function isNonOwnerPartyWallRun(
  blueprint: Pick<BlueprintPlan, 'ensemble'>,
  run: Pick<WallRun, 'kind' | 'nx' | 'ny'>,
): boolean {
  const ensemble = blueprint.ensemble;
  if (!ensemble?.partyWallOwner || run.kind !== 'outer' || run.ny !== 0) {
    return false;
  }

  // In the frontage-local blueprint frame, -x is the left lot boundary and
  // +x is the right boundary. Earlier ownership hides the later building's
  // left copy; later ownership hides the earlier building's right copy.
  const leftBelongsToEarlierNeighbor = run.nx === -1
    && ensemble.partyWallLeft
    && ensemble.partyWallOwner === 'earlier-frontage-member';
  const rightBelongsToLaterNeighbor = run.nx === 1
    && ensemble.partyWallRight
    && ensemble.partyWallOwner === 'later-frontage-member';
  return leftBelongsToEarlierNeighbor || rightBelongsToLaterNeighbor;
}

/** True for an exterior run this building is allowed to present visibly. */
export function isVisibleExteriorRun(
  blueprint: Pick<BlueprintPlan, 'ensemble'>,
  run: Pick<WallRun, 'kind' | 'nx' | 'ny'>,
): boolean {
  return run.kind === 'outer' && !isNonOwnerPartyWallRun(blueprint, run);
}
