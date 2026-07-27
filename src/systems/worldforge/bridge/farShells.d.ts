/**
 * @file farShells.ts — far-distance terrain shells (2026-07-21, Remy: "I don't
 * want to see any world edge at all").
 *
 * Ground mode streams ONE ~914 m local window; everything beyond it used to be
 * an edge-falloff drop faded to haze — a visible world edge. These builders
 * turn data the entry path ALREADY generated into two static, coarse,
 * vertex-colored ring meshes on the window's own vertical datum:
 *
 *  - REGION shell: the region heightfield (100 ft resolution, ~7.6 km square)
 *    the window was cut from. Continues the terrain past the window border.
 *    Inside/near the window rect it is blended down to the window's REAL
 *    heights and tucked slightly under, so the seam cannot crack or z-fight.
 *  - HORIZON shell: the atlas's regular grid heightmap sampled out to tens of
 *    km — distant ranges silhouetted through the haze. Tucked under the region
 *    shell where they overlap.
 *
 * Both are built ONCE per window entry (worker-side, structured-clone-safe
 * typed arrays), rendered as two static meshes — no streaming, no per-frame
 * work. Colors are baked here (biome-band + water + absolute-feet snow line)
 * so the render component stays dumb.
 */
import type { LocalArtifact, RegionArtifact } from "../artifacts";
/** One serializable shell grid: row-major heights (meters, window datum) and
 * baked linear-RGB vertex colors, positioned in window-relative meters. */
export interface FarShellGrid {
    cols: number;
    rows: number;
    /** Window-relative meters of sample (0,0) — can be negative. */
    originXM: number;
    originZM: number;
    spacingM: number;
    /** Surface Y in meters on the window's datum (window floor = 0). */
    heightsM: Float32Array;
    /** Linear RGB per sample (3 floats). */
    colors: Float32Array;
}
export interface FarShells {
    region: FarShellGrid;
    horizon: FarShellGrid | null;
}
/** Everything the horizon builder needs from the atlas — kept as plain data so
 * this module never imports the bridge (no cycle, worker-safe, testable). */
export interface HorizonSource {
    /** Regular lattice heights (FMG grid.cells.h, 0..100). */
    gridH: ArrayLike<number>;
    cellsX: number;
    cellsY: number;
    graphWidth: number;
    graphHeight: number;
    feetPerPixel: number;
}
/**
 * Build the REGION shell: the region heightfield expressed in window-relative
 * meters on the window's datum, seam-blended to the window's true heights.
 *
 * `windowHeights` is the ground world's encoded height grid (0..100, 1 unit =
 * 18 m via heightToMeters) with `windowCols`/`windowRows` at 1.524 m per cell.
 */
export declare function buildRegionShell(region: RegionArtifact, local: LocalArtifact, baseElevFt: number, snowLineFt: number, windowHeights: ArrayLike<number>, windowCols: number, windowRows: number): FarShellGrid;
/**
 * Build the HORIZON shell: the atlas's regular grid heightmap bilinearly
 * sampled on a square ring out to HORIZON_HALF_M around the window. Where it
 * overlaps the region shell's footprint it is pushed under the region field so
 * the two never fight.
 */
export declare function buildHorizonShell(source: HorizonSource, region: RegionArtifact, local: LocalArtifact, baseElevFt: number, snowLineFt: number): FarShellGrid;
/** Assemble both shells. Pure; every input is plain data. */
export declare function buildFarShells(region: RegionArtifact, local: LocalArtifact, baseElevFt: number, anchorLatitudeDeg: number | null, windowHeights: ArrayLike<number>, windowCols: number, windowRows: number, horizonSource: HorizonSource | null): FarShells;
