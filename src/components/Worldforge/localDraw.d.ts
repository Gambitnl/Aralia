/**
 * This file contains the pure drawing core that renders the L2 LOCAL layer
 * (a LocalArtifact: 600×600 5-ft material/elevation cells + feature list)
 * onto a 2D canvas context. It is the visual quality bar for replacing the
 * legacy Submap surface (Worldforge build order; Remy's 2026-06-11 focus:
 * Azgaar → submap → 3D world mode).
 *
 * Like atlasDraw/regionDraw it is DOM/React-free: unit tests drive it with a
 * stub context and headless proof scripts rasterize it without mounting UI.
 *
 * Rendering approach: terrain is rasterized once into an ImageData at NATIVE
 * cell resolution (1 px per 5-ft cell — 600×600) with per-cell material
 * color, elevation hillshading (NW light) and a water-depth ramp, then the
 * caller blits it scaled. Features draw as vector glyphs at view scale on
 * top so they stay crisp when zoomed.
 *
 * Called by: LocalMapView.tsx (interactive viewport), renderLocalProof
 * scripts. Depends on: systems/worldforge/artifacts (LocalArtifact shape).
 */
import type { LocalArtifact } from "../../systems/worldforge/artifacts";
export interface LocalDrawOptions {
    /** Optional custom canvas width/height, falls back to ctx.canvas. */
    width?: number;
    height?: number;
    /** View transform (canvas px per FOOT + offsets). Fitted when omitted. */
    scale?: number;
    offsetX?: number;
    offsetY?: number;
    /** Skip feature glyphs (terrain-only pass, e.g. for minimaps). */
    skipFeatures?: boolean;
    /** Atlas biome hue for the coherence chain — see rasterizeLocalTerrain. */
    biomeColor?: string;
}
/**
 * Rasterize the terrain grid into an ImageData at native cell resolution.
 * Exported separately so LocalMapView can cache it per artifact and the
 * unit tests can pin pixel-level goldens without a canvas.
 *
 * `biomeColor` (atlas `biomesData.color[biomeId]`, optional) carries the
 * L0→L1→L2 coherence chain down to the playable layer: the VEGETATED ground
 * materials (grass/wetland) blend 55% toward the atlas hue so a tropical
 * forest local reads tropical and a tundra local reads tundra, while
 * material-true surfaces (sand/dirt/rock/water/paved) stay themselves.
 */
export declare function rasterizeLocalTerrain(local: LocalArtifact, biomeColor?: string): ImageData;
/**
 * Draw the full local view: terrain blit + feature glyphs. The terrain
 * ImageData may be passed pre-rasterized (cache path); otherwise it is
 * computed on the fly.
 */
export declare function drawLocal(ctx: CanvasRenderingContext2D, local: LocalArtifact, options?: LocalDrawOptions, terrainRaster?: ImageData): void;
/**
 * Feature-glyph pass only — exported so LocalMapView can blit its cached
 * terrain raster and then overlay crisp vector features per frame without
 * re-rasterizing terrain through drawLocal.
 */
export declare function drawLocalFeatures(ctx: CanvasRenderingContext2D, local: LocalArtifact, view: {
    scale: number;
    offsetX: number;
    offsetY: number;
}): void;
