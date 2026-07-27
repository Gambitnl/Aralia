/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/07/2026, 00:39:13
 * Dependents: systems/world3d/buildingSceneModel.ts, systems/worldforge/bridge/interiorParts.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file projects a building's weathering receipt onto its real outer walls.
 *
 * It adds shallow wall bands, streaks, and roof-edge traces that make age and
 * local exposure visible in 3D. These boxes are presentation-only, carry their
 * own semantic tag, and deliberately leave the canonical walls, openings, roof
 * mesh, collision, and permanent-history evidence untouched.
 *
 * Called by: interiorParts.ts
 * Depends on: resolved blueprint weathering and canonical outer-wall runs
 */
import type { BlueprintPlan } from '../interior/blueprintTypes';
export declare const WEATHERING_PART_TAG = "building-weathering";
export type WeatheringDetailKind = 'wall-patina-band' | 'wall-weather-streak' | 'north-wall-grime' | 'roof-patina-edge' | 'roof-valley-grime' | 'roof-soot-patch' | 'roof-repair-patch';
export interface BuildingWeatheringPart {
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    baseY: number;
    colorHex: string;
    tag: typeof WEATHERING_PART_TAG;
    weatheringDetailKind: WeatheringDetailKind;
}
export declare function buildBuildingWeatheringParts(blueprint: BlueprintPlan, storeyHeightM: number): BuildingWeatheringPart[];
