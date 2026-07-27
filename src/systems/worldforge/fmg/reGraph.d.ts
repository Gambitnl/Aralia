import type { Grid } from "./utils/graphUtils";
import type { Pack } from "./features";
/** Recalculate Voronoi Graph to pack cells. Exact port of upstream `reGraph()`. */
export declare function reGraph(grid: Grid): Pack;
