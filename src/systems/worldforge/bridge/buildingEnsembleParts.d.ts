/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 20:03:49
 * Dependents: systems/worldforge/bridge/interiorParts.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file turns a town-authored building ensemble into restrained 3D cues.
 *
 * Rows receive a continuous-height eave band, while market arcades also gain
 * a shallow street canopy and bounded supporting columns. These boxes are
 * presentation-only: the blueprint remains the source of truth for walls,
 * doors, windows, collision, and navigation.
 *
 * Called by: interiorParts.ts
 * Depends on: BlueprintPlan ensemble metadata and its canonical site origin
 */
import type { BlueprintPlan } from '../interior/blueprintTypes';
export declare const ENSEMBLE_PART_TAG = "building-ensemble";
export type EnsembleDetailKind = 'shared-eave-band' | 'arcade-canopy' | 'arcade-column';
export interface BuildingEnsemblePart {
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    baseY: number;
    colorHex: string;
    tag: typeof ENSEMBLE_PART_TAG;
    ensembleDetailKind: EnsembleDetailKind;
}
/** Build bounded visual evidence of a row or market-arcade contract. */
export declare function buildBuildingEnsembleParts(blueprint: BlueprintPlan, storeyHeightM: number): BuildingEnsemblePart[];
