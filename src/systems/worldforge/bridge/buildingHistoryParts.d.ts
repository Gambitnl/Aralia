/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 21:20:42
 * Dependents: systems/worldforge/bridge/interiorParts.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file turns permanent backstory and live building events into visible
 * 3D parts.
 *
 * The blueprint already records exact wall-run, roof-plane, ridge, and mass
 * targets. This bridge only projects those facts into site-local meter boxes:
 * extension seams, sealed openings, wall repairs, scorch marks, boarded
 * windows, charred breach rims, and replacement roof strips. The shared roof
 * builder owns actual holes and ridge deformation; this module keeps the
 * remaining additive evidence tagged so tactical extraction can ignore it.
 *
 * Called by: interiorParts.ts
 * Depends on: BlueprintPlan history targets and the shared SitePart contract
 */
import type { BlueprintPlan } from '../interior/blueprintTypes';
import type { SitePart } from './interiorParts';
export declare const HISTORY_PART_TAG = "building-history";
export declare function buildBuildingHistoryParts(blueprint: BlueprintPlan, storeyHeightM: number): SitePart[];
