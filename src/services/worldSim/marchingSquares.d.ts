/**
 * @file marchingSquares.ts
 * Generic scalar-field → closed-polygon extraction via the marching squares algorithm.
 *
 * The field is sampled at integer cell coords. A cell is "inside" if field(x,y) >= threshold.
 * Returns one polygon per connected region of inside cells; each polygon is a closed loop
 * traced along cell boundaries.
 *
 * Connectivity convention: 4-neighbor (cells touching only at a diagonal corner are NOT
 * considered connected — they each get their own polygon, EXCEPT when the corner is a
 * shared boundary vertex, in which case the tracer may merge them into a figure-8.
 * For Aralia's use (coastlines bounded by ocean flood-fill, biome zones over contiguous
 * grids) this case is rare; if it becomes a problem, switch the next-edge selection in
 * the chain loop to prefer the right-hand-turn candidate by winding angle.
 */
import type { Polygon } from './types';
type Field = (x: number, y: number) => number;
export declare function extractPolygons(field: Field, cols: number, rows: number, threshold: number): Polygon[];
export {};
