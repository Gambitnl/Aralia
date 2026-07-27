/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 23:50:32
 * Dependents: systems/worldforge/bridge/interiorParts.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file buildingMotifParts.ts
 *
 * Converts a resolved building-role motif recipe into additive 3D boxes. The
 * architecture resolver decides which cues belong to the building; this file
 * gives each cue a bounded silhouette using the building's existing wall,
 * roof, and trim palette. The shared interior bridge appends these records
 * after permanent walls, floors, doors, windows, and stairs are complete.
 *
 * Motifs intentionally use a dedicated tag and never become structural truth.
 * Rendering can show them, map/debug views can inspect them, and tactical
 * extraction can ignore them without guessing from color or dimensions.
 */
import type { BuildingMotif, BlueprintPlan } from '../interior/blueprintTypes';
/** Tag stamped on additive building-type/culture recognition geometry. */
export declare const MOTIF_PART_TAG = "motif";
/**
 * The exact subset of a renderable site part that motif geometry needs.
 * This structural contract avoids a runtime cycle back into interiorParts;
 * TypeScript verifies these records can be appended to that broader part list.
 */
export interface BuildingMotifPart {
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    colorHex: string;
    baseY?: number;
    tag: typeof MOTIF_PART_TAG;
    motifKind: BuildingMotif;
}
/**
 * Project the resolved role/culture motif recipe into deterministic site parts.
 *
 * Generated blueprints currently expose the min-Y wall as their street face,
 * so negative site-Z is the facade. Every dimension is bounded by the actual
 * blueprint envelope, which keeps the same recipe useful on cottages and large
 * civic buildings. `motifVariant` changes proportions and side placement only;
 * it cannot add or remove a district's chosen recognition vocabulary.
 */
export declare function buildBuildingMotifParts(blueprint: BlueprintPlan, storeyHeightM: number): BuildingMotifPart[];
