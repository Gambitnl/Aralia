/**
 * @file roads.ts
 * Generate a connected road graph between sites.
 *
 *  1. For each unordered pair of towns, run A* across the heightfield (water = impassable,
 *     steep slope = high cost).
 *  2. Build a minimum spanning tree over the pairwise distances → n-1 edges.
 *  3. Add up to 20% extra short edges for redundancy.
 */
import type { Road, Site } from './types';
export declare function generateRoads(heights: number[], cols: number, rows: number, sites: Site[]): Road[];
