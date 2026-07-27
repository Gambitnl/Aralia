/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 09:51:50
 * Dependents: components/Worldforge/regionDraw.ts, systems/worldforge/region/generateRegion.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file provides the shared river-centerline smoothing used by both L1
 * region generation and the region canvas renderer.
 *
 * WF-G5 exists because the visual river band and the terrain carve drifted
 * apart at tight bends. Keeping the smoothing here, beside the region
 * generator, gives the generator and renderer one pure source of truth without
 * making systems code import from React/component code.
 *
 * Called by: generateRegion.ts (river carve), regionDraw.ts (river band draw).
 * Depends on: no runtime systems; this helper is deterministic geometry math.
 */
import type { Feet } from '../units';
export declare const REGION_RIVER_SMOOTHING_ITERATIONS = 3;
export declare function smoothRegionRiverCenterline(points: Array<[Feet, Feet]>, iterations?: number): Array<[Feet, Feet]>;
