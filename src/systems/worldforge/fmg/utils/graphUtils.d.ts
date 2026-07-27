import { type Cells, type Point, type Vertices } from "../voronoi";
import type { GridFeature } from "../features";
/** Grid-level cells: Voronoi topology plus the generation fields added by the heightmap (h), features (t, f) and climate (temp, prec) stages. */
export type GridCells = Cells & {
    h?: Uint8Array;
    t?: Int8Array;
    f?: Uint16Array;
    temp?: Int8Array;
    prec?: Uint8Array;
};
export interface Grid {
    spacing: number;
    cellsDesired: number;
    boundary: Point[];
    points: Point[];
    cellsX: number;
    cellsY: number;
    seed: string;
    cells: GridCells;
    vertices: Vertices;
    features?: GridFeature[];
}
/**
 * Generates a Voronoi grid based on jittered grid points
 * @returns {Object} - The generated grid object containing spacing, cellsDesired, boundary, points, cellsX, cellsY, cells, vertices, and seed
 */
export declare const generateGrid: (seed: string, graphWidth: number, graphHeight: number, cellsDesired: number) => Grid;
/**
 * Calculates the Voronoi diagram from given points and boundary
 * @param {Array} points - The array of points for Voronoi calculation
 * @param {Array} boundary - The boundary points to clip the Voronoi cells
 * @returns {Object} - An object containing Voronoi cells and vertices
 */
export declare const calculateVoronoi: (points: Point[], boundary: Point[]) => {
    cells: Cells;
    vertices: Vertices;
};
/**
 * Returns a cell index on a regular square grid based on x and y coordinates
 * @param {number} x - The x coordinate
 * @param {number} y - The y coordinate
 * @param {Object} grid - The grid object containing spacing, cellsX, and cellsY
 * @returns {number} - The index of the cell in the grid
 */
export declare const findGridCell: (x: number, y: number, grid: Grid) => number;
/**
 * return array of cell indexes in radius on a regular square grid
 * @param {number} x - The x coordinate
 * @param {number} y - The y coordinate
 * @param {number} radius - The search radius
 * @param {Object} grid - The grid object containing spacing, cellsX, and cellsY
 * @returns {Array} - An array of cell indexes within the specified radius
 */
export declare const findGridAll: (x: number, y: number, radius: number, grid: Grid) => number[];
/**
 * Returns the polygon points for a packed cell given its index
 * @param {number} i - The index of the packed cell
 * @returns {Array} - An array of polygon points for the specified cell
 */
export declare const getPackPolygon: (cellIndex: number, packedGraph: {
    cells: {
        v: number[][];
    };
    vertices: {
        p: Point[];
    };
}) => Point[];
/**
 * Returns the polygon points for a grid cell given its index (upstream
 * getGridPolygon — verbatim; slice 3, needed by Ice.generate)
 * @param {number} i - The index of the grid cell
 * @returns {Array} - An array of polygon points for the specified grid cell
 */
export declare const getGridPolygon: (i: number, grid: {
    cells: {
        v: number[][];
    };
    vertices: {
        p: Point[];
    };
}) => Point[];
/**
 * Returns the index of the packed cell containing the given x and y
 * coordinates (upstream findClosestCell — verbatim; slice 3, needed by
 * Routes.getPoints). Requires the `pack.cells.q` quadtree of [x, y, cellId]
 * triples that upstream reGraph builds (in this port it is built by
 * generateWorld.ts, see the strip note in reGraph.ts).
 * @param {number} x - The x coordinate
 * @param {number} y - The y coordinate
 * @param {number} radius - The search radius (default is Infinity)
 * @returns {number|undefined} - The index of the found cell or undefined
 */
export declare const findClosestCell: (x: number, y: number, radius: number | undefined, packedGraph: {
    cells: {
        q?: {
            find: (x: number, y: number, r?: number) => number[] | undefined;
        };
    };
}) => number | undefined;
/** Minimal structural type for height-bearing graphs (grid or pack). */
export type HeightGraph = {
    cells: {
        h: ArrayLike<number>;
    };
};
/**
 * Checks if a cell is land based on its height
 * @param {number} i - The index of the cell
 * @returns {boolean} - True if the cell is land, false otherwise
 */
export declare const isLand: (i: number, packedGraph: HeightGraph) => boolean;
/**
 * Checks if a cell is water based on its height
 * @param {number} i - The index of the cell
 * @returns {boolean} - True if the cell is water, false otherwise
 */
export declare const isWater: (i: number, packedGraph: HeightGraph) => boolean;
/**
 * Returns all data points within a radius of (x, y) in a d3-style quadtree —
 * verbatim port of upstream src/utils/graphUtils.ts findAllInQuadtree
 * (added for Military.generate regiment merging). Accesses quadtree
 * internals (_x0/_root/_x) exactly like upstream; works against our
 * utils/quadtree.ts d3 port. Side effects on node data (`scanned`,
 * `selected`) are upstream behavior and preserved.
 */
export declare const findAllInQuadtree: (x: number, y: number, radius: number, quadtree: any) => any;
