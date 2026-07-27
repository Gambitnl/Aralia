/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 11/06/2026, 03:03:15
 * Dependents: None (Orphan)
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
export interface OverlayMarker {
    kind: "party" | "npc" | "quest";
    x: number;
    y: number;
    label?: string;
    facing?: number;
}
export interface OverlayView {
    scale: number;
    offsetX: number;
    offsetY: number;
    mouseX?: number;
    mouseY?: number;
}
export interface OverlayBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}
/**
 * Translates a marker's real-world feet coordinates to screen canvas pixels
 * using either L1 Region bounds or L0 Atlas scaling coefficients.
 */
export declare function getMarkerScreenPos(marker: {
    x: number;
    y: number;
}, view: OverlayView, bounds?: OverlayBounds): {
    x: number;
    y: number;
};
/**
 * Draws all overlay markers onto the canvas context.
 * Renders above cache layers to maintain dynamic movements and animations during panning.
 */
export declare function drawOverlay(ctx: CanvasRenderingContext2D, markers: OverlayMarker[], view: OverlayView, bounds?: OverlayBounds): void;
