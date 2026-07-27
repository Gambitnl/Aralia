/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 09:51:50
 * Dependents: components/Worldforge/LocalMapView.tsx, components/Worldforge/RegionMapView.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file contains the pure drawing function that renders the refined L1 region map
 * from a RegionArtifact onto a 2D canvas context.
 *
 * It is designed to be completely independent of the DOM or React. This allows it to be used in
 * unit tests using a mock canvas context, and in headless node/Playwright scripts to generate
 * proof-of-concept images without mounting any UI components.
 *
 * Layer drawing sequence:
 * 1. Hypsometric color heightfield grid cells with local min/max stretch and NW slope shading.
 * 2. River banks as width-scaled blue polyline paths.
 * 3. Town sites (empty placeholder loop for future C2 expansion).
 * 4. Roads (empty placeholder loop for future C2 expansion).
 *
 * Called by: AtlasDemo.tsx (React UI wrapper), renderAtlasProof.ts (headless verification script).
 * Depends on: generateRegion.ts (supplies the RegionArtifact data prop).
 */
import type { RegionArtifact } from "../../systems/worldforge/artifacts";
export interface RegionDrawOptions {
    /** Optional custom canvas width, falls back to ctx.canvas.width. */
    width?: number;
    /** Optional custom canvas height, falls back to ctx.canvas.height. */
    height?: number;
    /** Optional custom scale factor. If not provided, computed to fit canvas. */
    scale?: number;
    /** Optional custom X offset in canvas space. */
    offsetX?: number;
    /** Optional custom Y offset in canvas space. */
    offsetY?: number;
    /**
     * Atlas coherence (Remy, 2026-06-11): the anchor cell's biome color from
     * `atlas.biomesData.color[biomeId]` â€” the region tints its land with the
     * SAME hue the atlas shows at the descend point, so L1 reads as a zoomed
     * piece of L0 rather than a generic green ramp. When omitted, the legacy
     * hypsometric palette renders (kept for tests/back-compat).
     */
    biomeColor?: string;
}
/** A fitted view: scale + centering offsets for a bounds inside a viewport. */
export interface RegionFitView {
    scale: number;
    offsetX: number;
    offsetY: number;
}
/**
 * Compute the fitted view (95% fill, centered) for region bounds inside a
 * viewport. Pure â€” extracted from RegionMapView for the WF-G4 regression
 * tests: degenerate bounds (zero/negative extent) must yield a FINITE,
 * positive scale rather than Infinity, which propagated into an unusable
 * offscreen cache canvas and a black region view.
 */
export declare function computeRegionFitView(bounds: {
    width: number;
    height: number;
}, viewportWidth: number, viewportHeight: number): RegionFitView;
export declare function drawRegion(ctx: CanvasRenderingContext2D, region: RegionArtifact, options?: RegionDrawOptions): void;
