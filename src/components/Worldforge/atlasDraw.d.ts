/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 09:06:27
 * Dependents: components/Worldforge/AtlasDemo.tsx, components/Worldforge/AtlasMapView.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file contains the pure drawing functions that render the FMG world map onto a 2D canvas context.
 *
 * It is completely decoupled from the DOM or React. This allows it to be used in unit tests
 * using a mock canvas context, and in headless node/Playwright scripts to generate map proof
 * images.
 *
 * Features implemented:
 * 1. Smooth radial ocean depth gradient (decoupled from cell facets)
 * 2. Land cell biome rendering + NW slope-based hillshading (3D terrain relief)
 * 3. Double-stroke coastlines (wider shelf glow + crisp dark blue boundary stroke)
 * 4. River discharge width-scaled polylines
 * 5. Optional graticule grid lines (latitude & longitude dashed curves/lines)
 * 6. Alternating miles/feet scale bar inside a translucent background box
 * 7. Optional atlas overlays:
 *    - Territory color tint blending for state, culture, religion, or province ownership
 *    - Crisp state border strokes (dark-purple boundaries along shared Voronoi edges)
 *    - Route networks (tiered strokes from routeMapStyle.ts, shared with the SVG renderer; trails/paths fade per-segment in forest)
 *    - Burg markers (capitals as larger double red/white circles, towns as small white circles)
 *    - Serif state name labels and sans-serif burg name labels with zoom thresholds (capitals at scale >= 1.2, towns at scale >= 2.0)
 *    - Simple 2D bounding-box collision detection to declutter labels and prevent overlaps
 *
 * Called by: AtlasMapView.tsx (React UI wrapper), renderAtlasProof.ts (headless verification script)
 * Depends on: generateAtlas.ts, generateWorld.ts, and atlasArtifact.ts (for FEET_PER_FMG_PIXEL)
 */
import type { FmgAtlasResult } from "../../systems/worldforge/fmg/generateAtlas";
export interface AtlasView {
    offsetX: number;
    offsetY: number;
    scale: number;
    showScaleBar?: boolean;
    showGraticule?: boolean;
    showPolitical?: boolean;
    /** Cell tint mode for atlas territory overlays. Political remains the default FMG view. */
    overlayMode?: AtlasOverlayMode;
    /** Points of interest (pack.markers — Markers.generate port). Default false. */
    showMarkers?: boolean;
    /** Event/danger areas (pack.zones — Zones.generate port). Default false. */
    showZones?: boolean;
    /** State regiments (states[].military — Military.generate port). Default false. */
    showMilitary?: boolean;
    /** Voronoi cell mesh — thin edges on every cell (Azgaar "Cells" layer). Default false. */
    showCells?: boolean;
}
export interface CacheView {
    scale: number;
    seed: string;
    showGraticule?: boolean;
    showPolitical?: boolean;
    overlayMode?: AtlasOverlayMode;
    showMarkers?: boolean;
    showZones?: boolean;
    showMilitary?: boolean;
    showCells?: boolean;
}
interface BBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}
export type AtlasOverlayMode = "political" | "culture" | "religion" | "province";
interface AtlasOverlayEntity {
    i?: number;
    name?: string;
    fullName?: string;
    color?: string;
    removed?: boolean;
}
/**
 * Checks whether a cached render is still valid for the current rendering request.
 * If the user switches atlas tint modes or toggles static layers, the cache is invalidated.
 */
export declare function isCacheValid(cacheView: CacheView | null, nextScale: number, nextSeed: string, nextShowGraticule?: boolean, nextShowPolitical?: boolean, nextShowMarkers?: boolean, nextShowZones?: boolean, nextShowMilitary?: boolean, nextOverlayMode?: AtlasOverlayMode, nextShowCells?: boolean): boolean;
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
 * Confirms that a generated FMG color is safe to parse as a canvas hex color.
 * Some ported entities can be present before the color field is populated, so
 * overlay drawing must not depend on the upstream color always existing.
 */
export declare function isHexColor(value: string | undefined): value is string;
/**
 * Produces a deterministic fallback color from an entity's kind, id and name.
 * This preserves visual distinctions for unfinished or partially generated FMG
 * records without adding random colors that would change between renders.
 */
export declare function stableHashColor(kind: AtlasOverlayMode, id: number, entity?: AtlasOverlayEntity): {
    r: number;
    g: number;
    b: number;
};
/**
 * Looks up the selected per-cell overlay assignment and returns the entity tint.
 * Cell id 0 / neutral assignments intentionally return null so the base biome
 * terrain remains visible for wildlands, no-religion, and no-province cells.
 */
export declare function getOverlayColor(atlas: FmgAtlasResult, cellId: number, mode: AtlasOverlayMode): {
    r: number;
    g: number;
    b: number;
} | null;
/**
 * Utility to find the nearest clean round number (1, 2, 5, 10, 20, 50, etc.)
 * below or close to the target value for scale display rendering.
 */
export declare function getCleanNumber(val: number): number;
/**
 * Pure helper function to determine if a border exists between two states.
 */
export declare function isStateBorder(stateIdA: number, stateIdB: number): boolean;
/**
 * Pure helper function to determine if a burg name should be shown based on capital status and scale.
 */
export declare function shouldShowBurgLabel(isCapital: boolean, scale: number): boolean;
/**
 * Helper to check if two bounding boxes intersect (AABB collision check).
 */
export declare function intersects(a: BBox, b: BBox): boolean;
/**
 * Draws the dashed graticule grid lines mapping coordinate lines on the map canvas.
 */
export declare function drawGraticule(ctx: CanvasRenderingContext2D, atlas: FmgAtlasResult, view: AtlasView): void;
/**
 * Draws the cartographic scale bar (miles and feet alternating indicator).
 */
export declare function drawScaleBar(ctx: CanvasRenderingContext2D, atlas: FmgAtlasResult, view: AtlasView): void;
export declare function drawAtlas(ctx: CanvasRenderingContext2D, atlas: FmgAtlasResult, view: AtlasView): void;
export {};
