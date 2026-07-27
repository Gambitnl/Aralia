import type { Vertices } from "../voronoi";
/**
 * Walks the vertex graph from a starting vertex, keeping to the boundary
 * between cells of the given type, and returns the vertex chain.
 */
export declare const connectVertices: ({ vertices, startingVertex, ofSameType, addToChecked, closeRing, }: {
    vertices: Vertices;
    startingVertex: number;
    ofSameType: (cellId: number) => boolean;
    addToChecked?: (cellId: number) => void;
    closeRing?: boolean;
}) => any[];
/**
 * Returns isolines (borders) for different types of cells in the graph.
 * Port of upstream getIsolines restricted to the `polygons` output mode (the
 * only mode the generation path uses — Ice.generate and getPoles*); the
 * fill/halo/waterGap SVG-string modes are stripped (see file header). The
 * cell scan order, the inner-lake skip and the vertex-chain walk are
 * verbatim.
 */
export declare const getIsolines: (graph: any, getType: (cellId: number) => any, options?: {
    polygons?: boolean;
}) => any;
/**
 * Returns poles of inaccessibility for each cell type (upstream
 * getPolesOfInaccessibility — verbatim; polylabel precision 20).
 */
export declare const getPolesOfInaccessibility: (graph: any, getType: (cellId: number) => any) => any;
/**
 * Finds the shortest path between two cells using a cost-based pathfinding
 * algorithm (upstream findPath — verbatim, including the
 * `totalCost >= cost[next]` comparison against an undefined entry being
 * false on first visit).
 * @param start - The ID of the starting cell.
 * @param isExit - Returns true if the cell is the exit cell.
 * @param getCost - Path cost from current to next; Infinity = impassable.
 * @param packedGraph - The packed graph containing cells and connections.
 * @returns Cell ids of the path from start to exit, or null.
 */
export declare const findPath: (start: number, isExit: (id: number) => boolean, getCost: (current: number, next: number) => number, packedGraph?: any) => number[] | null;
