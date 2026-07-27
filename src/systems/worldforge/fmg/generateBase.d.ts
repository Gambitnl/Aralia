import { type Grid } from "./utils/graphUtils";
import { type GridFeature } from "./features";
export interface FmgBaseOptions {
    /** Map width in FMG map units (upstream: browser window width). Default 960. */
    width?: number;
    /** Map height in FMG map units (upstream: browser window height). Default 540. */
    height?: number;
    /**
     * Desired cell count before jittering (upstream: "points" option,
     * density 4 ⇒ 10000 cells). Must be one of FMG's supported densities
     * (1000..100000) for the blob/line power tables to have exact entries.
     * Default 10000.
     */
    cellsDesired?: number;
    /**
     * Heightmap template key from ./heightmap-templates (upstream randomizes
     * via template probabilities in the UI; pass explicitly here).
     * Default "continents".
     */
    template?: string;
    /**
     * Depression depth threshold for adding lakes (upstream DOM input
     * `lakeElevationLimitOutput`, default 20; 80 disables the step).
     */
    lakeElevationLimit?: number;
}
export interface FmgBaseResult {
    seed: string;
    graphWidth: number;
    graphHeight: number;
    template: string;
    /**
     * The FMG grid: points/boundary, Voronoi cells & vertices, plus the
     * generation outputs — cells.h (heights 0-100), cells.t (distance field),
     * cells.f (feature ids) and features (index 0 is a literal 0 placeholder,
     * as upstream).
     */
    grid: Grid;
}
/**
 * Add lakes on land cells in deep depressions that cannot pour out.
 * Exact port of `addLakesInDeepDepressions` from upstream public/main.js.
 */
export declare function addLakesInDeepDepressions(grid: Grid, elevationLimit: number): void;
/**
 * Near-sea lakes usually get a lot of water inflow; most of them should
 * break the threshold and flow out to the sea (see Ancylus Lake).
 * Exact port of `openNearSeaLakes` from upstream public/main.js.
 */
export declare function openNearSeaLakes(grid: Grid, template: string): void;
/**
 * Generate the FMG physical-world base headlessly. Deterministic: the same
 * seed + options always produce the same grid, heights and features.
 */
export declare function generateFmgBase(seed: string, options?: FmgBaseOptions): FmgBaseResult;
/** Count grid features by type (placeholder element 0 is skipped). */
export declare function countFeaturesByType(features: GridFeature[]): Record<string, number>;
