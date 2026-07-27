/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 18:49:54
 * Dependents: systems/worldforge/interior/generateBuilding.ts, systems/worldforge/townsim/townSimRegistration.ts, systems/worldforge/townsim/types.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file buildingExtensions.ts
 *
 * Replays explicit structural extension outcomes into the canonical footprint.
 * This happens before partitioning so rooms, walls, stairs, and roofs all agree
 * that the new mass is real architecture rather than renderer-only dressing.
 */
import type { BlueprintPlan, BuildingEvent, BuildingEventHistory, StyleResolved } from './blueprintTypes';
import type { Feet } from '../units';
import type { Footprint, FootprintMass } from './footprint';
export interface StructuralExtensionResult {
    footprint: Footprint;
    /** Present only when normalization moved the original footprint's center. */
    siteOriginFt?: {
        x: Feet;
        y: Feet;
    };
}
/** One prevalidated addition a living-town event may persist later. */
export interface PlannedBuildingExtension {
    mass: Pick<FootprintMass, 'kind' | 'x' | 'y' | 'w' | 'h'>;
    phase: number;
    /** Roof grammar that set the addition's proportions, retained as evidence. */
    roofForm: StyleResolved['roofForm'];
}
/**
 * Apply every structural extension in chronological log order. Coordinates in
 * event payloads stay in the original footprint frame, making save replay
 * independent of normalization introduced by earlier additions.
 */
export declare function applyStructuralExtensions(base: Footprint, history: BuildingEventHistory | readonly BuildingEvent[] | undefined, limits?: {
    maxWidthFt?: number;
    maxDepthFt?: number;
}): StructuralExtensionResult;
export interface PlanBuildingExtensionsOptions {
    maxWidthFt?: number;
    maxDepthFt?: number;
    roofForm?: StyleResolved['roofForm'];
    /** Stable district identity keeps proportions coherent across neighboring buildings. */
    districtKey?: string;
    maxCandidates?: number;
}
/**
 * Plan up to two cumulative additions whose dimensions speak the district's
 * roof language. Orientation comes from building identity, so neighboring
 * buildings share proportions without becoming mirrored clones.
 */
export declare function planBuildingExtensionCandidates(plan: BlueprintPlan, options?: PlanBuildingExtensionsOptions): PlannedBuildingExtension[];
