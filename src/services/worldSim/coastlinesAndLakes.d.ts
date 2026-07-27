/**
 * @file coastlinesAndLakes.ts
 * Polygon extraction for coastlines (boundary of land) and lakes (interior water).
 *
 * Coastlines: marching squares at the sea-level threshold over the heightmap.
 * Lakes: water cells (height < SEA_LEVEL) NOT connected to the map border via
 * 4-neighbor flood-fill. The ocean is classified first; everything else that
 * is water becomes a lake.
 */
import type { Polygon } from './types';
export declare function extractCoastlines(heights: number[], cols: number, rows: number): Polygon[];
export declare function extractLakes(heights: number[], cols: number, rows: number): Polygon[];
