/**
 * @file voronoi.ts — ported from Azgaar's Fantasy-Map-Generator (MIT).
 * Upstream: .tmp/azgaar-src/src/modules/voronoi.ts (TypeScript refactor branch).
 * See ./ATTRIBUTION.md. Faithfulness rule: algorithm logic, RNG call order and
 * data layouts are preserved exactly — do not refactor or "clean up".
 */
import type Delaunator from "delaunator";
export type Vertices = {
    p: Point[];
    v: number[][];
    c: number[][];
};
export type Cells = {
    v: number[][];
    c: number[][];
    b: number[];
    i: Uint32Array<ArrayBufferLike>;
};
export type Point = [number, number];
/**
 * Creates a Voronoi diagram from the given Delaunator, a list of points, and the number of points. The Voronoi diagram is constructed using (I think) the {@link https://en.wikipedia.org/wiki/Bowyer%E2%80%93Watson_algorithm |Bowyer-Watson Algorithm}
 * The {@link https://github.com/mapbox/delaunator/ |Delaunator} library uses {@link https://en.wikipedia.org/wiki/Doubly_connected_edge_list |half-edges} to represent the relationship between points and triangles.
 * @param {{triangles: Uint32Array, halfedges: Int32Array}} delaunay A {@link https://github.com/mapbox/delaunator/blob/master/index.js |Delaunator} instance.
 * @param {[number, number][]} points A list of coordinates.
 * @param {number} pointsN The number of points.
 */
export declare class Voronoi {
    delaunay: Delaunator<Float64Array<ArrayBufferLike>>;
    points: Point[];
    pointsN: number;
    cells: Cells;
    vertices: Vertices;
    constructor(delaunay: Delaunator<Float64Array<ArrayBufferLike>>, points: Point[], pointsN: number);
    /**
     * Gets the IDs of the points comprising the given triangle. Taken from {@link https://mapbox.github.io/delaunator/#triangle-to-points| the Delaunator docs.}
     * @param {number} t The index of the triangle
     * @returns {[number, number, number]} The IDs of the points comprising the given triangle.
     */
    private pointsOfTriangle;
    /**
     * Identifies what triangles are adjacent to the given triangle. Taken from {@link https://mapbox.github.io/delaunator/#triangle-to-triangles| the Delaunator docs.}
     * @param {number} triangleIndex The index of the triangle
     * @returns {number[]} The indices of the triangles that share half-edges with this triangle.
     */
    private trianglesAdjacentToTriangle;
    /**
     * Gets the indices of all the incoming and outgoing half-edges that touch the given point. Taken from {@link https://mapbox.github.io/delaunator/#point-to-edges| the Delaunator docs.}
     * @param {number} start The index of an incoming half-edge that leads to the desired point
     * @returns {[number, number, number]} The indices of all half-edges (incoming or outgoing) that touch the point.
     */
    private edgesAroundPoint;
    /**
     * Returns the center of the triangle located at the given index.
     * @param {number} triangleIndex The index of the triangle
     * @returns {[number, number]} The coordinates of the triangle's circumcenter.
     */
    private triangleCenter;
    /**
     * Retrieves all of the half-edges for a specific triangle `triangleIndex`. Taken from {@link https://mapbox.github.io/delaunator/#edge-and-triangle| the Delaunator docs.}
     * @param {number} triangleIndex The index of the triangle
     * @returns {[number, number, number]} The edges of the triangle.
     */
    private edgesOfTriangle;
    /**
     * Enables lookup of a triangle, given one of the half-edges of that triangle. Taken from {@link https://mapbox.github.io/delaunator/#edge-and-triangle| the Delaunator docs.}
     * @param {number} e The index of the edge
     * @returns {number} The index of the triangle
     */
    private triangleOfEdge;
    /**
     * Moves to the next half-edge of a triangle, given the current half-edge's index. Taken from {@link https://mapbox.github.io/delaunator/#edge-to-edges| the Delaunator docs.}
     * @param {number} e The index of the current half edge
     * @returns {number} The index of the next half edge
     */
    private nextHalfedge;
    /**
     * Moves to the previous half-edge of a triangle, given the current half-edge's index. Taken from {@link https://mapbox.github.io/delaunator/#edge-to-edges| the Delaunator docs.}
     * @param {number} e The index of the current half edge
     * @returns {number} The index of the previous half edge
     */
    /**
     * Finds the circumcenter of the triangle identified by points a, b, and c. Taken from {@link https://en.wikipedia.org/wiki/Circumscribed_circle#Circumcenter_coordinates| Wikipedia}
     * @param {[number, number]} a The coordinates of the first point of the triangle
     * @param {[number, number]} b The coordinates of the second point of the triangle
     * @param {[number, number]} c The coordinates of the third point of the triangle
     * @return {[number, number]} The coordinates of the circumcenter of the triangle.
     */
    private circumcenter;
}
