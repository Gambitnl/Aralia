/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 23:49:59
 * Dependents: systems/worldforge/bridge/buildingMotifParts.ts, systems/worldforge/bridge/interiorParts.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file turns a resolved construction kit into visible exterior 3D detail.
 *
 * The building generator already owns permanent walls, windows, and roof
 * geometry. This bridge adds shallow material evidence outside that structure:
 * foundations, masonry or board courses, open shutters, roof-edge profiles, and
 * ornament. Every part follows real wall runs and window targets, remains tagged
 * as presentation detail, and never changes the canonical interior plan.
 *
 * Called by: interiorParts.ts
 * Depends on: BlueprintPlan construction data and canonical outer-wall runs
 */
import type { BlueprintPlan, GlazingType } from '../interior/blueprintTypes';
export declare const MATERIAL_PART_TAG = "building-material";
export type MaterialDetailKind = 'foundation' | 'wall-course' | 'window-mullion' | 'shutter-panel' | 'shutter-slat' | 'roof-edge' | 'bargeboard' | 'ridge-crest' | 'ornament';
export interface BuildingMaterialPart {
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    colorHex: string;
    baseY?: number;
    tag: typeof MATERIAL_PART_TAG;
    materialDetailKind: MaterialDetailKind;
}
export declare const WINDOW_HALF_FT = 1.5;
export declare const WINDOW_MARGIN_FT = 0.2;
export declare const WINDOW_SILL_FT = 3;
export declare const WINDOW_HEAD_FT = 6.5;
/**
 * Derive the render tone for wall-mounted dressing from the resolved palette.
 *
 * - A trim already separated by >= TRIM_MIN_LUMA_DELTA is returned unchanged.
 * - A trim with a clear lean (>= TRIM_LEAN_RESPECT toward light or dark) is
 *   pushed FURTHER in its own direction to exactly the minimum separation, so
 *   a family that chose "lighter than walls" stays lighter.
 * - Near-tied trims pick the direction with headroom: dark walls (luma < 0.45)
 *   take lighter dressing (log chinking, limewash bands); light walls take
 *   darker dressing (half-timber beams, dressed-stone courses).
 *
 * Hue is preserved: darkening scales toward black, lightening lerps toward
 * white, so each family's trim stays recognizably its own material.
 */
export declare function dressingContrastTone(trimHex: string, wallHex: string): string;
export declare function glazingPaneColor(glazing: GlazingType): string;
export declare function buildBuildingMaterialParts(blueprint: BlueprintPlan, storeyHeightM: number): BuildingMaterialPart[];
