/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 02:38:27
 * Dependents: components/Worldforge/atlasSvg.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file calculates the terrain colors for cells on the overworld map.
 *
 * It takes the biome, elevation, and mountain slopes of the map and determines
 * the color (like green forests, yellow deserts, or grey peaks) for each land region.
 * By merging cells into groups with similar elevations and slopes, it creates a clean,
 * painted look for the map while keeping rendering fast.
 *
 * Called by: atlasSvg.ts (buildAtlasSvgModel)
 * Depends on: FmgAtlasResult types
 */
import type { FmgAtlasResult } from '../../systems/worldforge/fmg/generateAtlas';
/**
 * Parses a standard hexadecimal color code (e.g. "#2ca25f") into its red, green,
 * and blue integer values (0-255). Supports both 3-character and 6-character hex formats.
 */
export declare function parseHexColor(hex: string): {
    r: number;
    g: number;
    b: number;
};
/**
 * Computes the North-West slope shading value for a cell.
 * Positive slope represents slopes facing North-West (which receive shadow),
 * and negative slope represents slopes facing South-East (which receive light).
 */
export declare function getCellSlope(atlas: FmgAtlasResult, i: number): number;
/**
 * Maps a calculated slope value into one of three buckets:
 * 0 = Lit (slope < -0.015)
 * 1 = Neutral (-0.015 <= slope <= 0.015)
 * 2 = Shaded (slope > 0.015)
 */
export declare function getCellSlopeBucket(slope: number): number;
/**
 * Maps a cell height value into one of four elevation buckets:
 * 0 = Lowland (height < 40)
 * 1 = Highland Tier 1 (40 <= height < 60)
 * 2 = Highland Tier 2 (60 <= height < 80)
 * 3 = Peak (height >= 80)
 */
export declare function getCellElevationBucket(h: number): number;
/**
 * Constructs a unique terrain key for a cell to merge it with other similar cells.
 * Returns null if the cell is water (height < 20).
 */
export declare function getTerrainKey(atlas: FmgAtlasResult, i: number): string | null;
/**
 * Translates a terrain key (e.g. "3_1_2") back into a final blended RGB color.
 */
export declare function getTerrainColor(atlas: FmgAtlasResult, key: string): string;
