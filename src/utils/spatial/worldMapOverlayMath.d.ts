/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/05/2026, 18:04:55
 * Dependents: utils/spatial/index.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file translates Aralia's hidden world-grid cells onto the visible Azgaar atlas.
 *
 * The travel UI still thinks in row-and-column world cells, while the player sees a
 * pannable and zoomable Azgaar iframe. These helpers keep the highlight boxes lined up
 * with the same transform that the iframe bridge uses for click targeting.
 *
 * Called by: MapPane.tsx for travel precision overlays.
 * Depends on: the Azgaar iframe bridge transform shape exposed by the embedded atlas.
 */
export type AzgaarAtlasTransform = {
    graphWidth: number;
    graphHeight: number;
    viewX: number;
    viewY: number;
    scale: number;
};
export type OverlayPercentRect = {
    left: number;
    top: number;
    width: number;
    height: number;
};
export declare function worldNormalizedToOverlayNormalized(normalized: number, axis: 'x' | 'y', transform: AzgaarAtlasTransform | null | undefined): number;
export declare function getCellOverlayPercentRect(cellX: number, cellY: number, cols: number, rows: number, transform: AzgaarAtlasTransform | null | undefined): OverlayPercentRect;
/**
 * Single-point overlay position (percent) for a normalized world coordinate.
 * Used by AtlasPlayerMarker to track sub-cell 3D player positions on the Azgaar iframe.
 */
export declare function getWorldPosOverlayPercentPoint(normX: number, normY: number, transform: AzgaarAtlasTransform | null | undefined): {
    left: number;
    top: number;
};
