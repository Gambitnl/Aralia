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
/** True when this building keeps the run tactically but its neighbor renders it. */
export declare function isNonOwnerPartyWallRun(blueprint: Pick<BlueprintPlan, 'ensemble'>, run: Pick<WallRun, 'kind' | 'nx' | 'ny'>): boolean;
/** True for an exterior run this building is allowed to present visibly. */
export declare function isVisibleExteriorRun(blueprint: Pick<BlueprintPlan, 'ensemble'>, run: Pick<WallRun, 'kind' | 'nx' | 'ny'>): boolean;
