/**
 * @file rivers.ts
 * Flow accumulation + polyline river tracing on a heightmap.
 *
 * Algorithm:
 *  1. For each land cell (height >= SEA_LEVEL), find the steepest-descent neighbor among 8.
 *  2. Sort cells by height descending. Walk in order; for each cell, add `flow[i]` to
 *     `flow[descent[i]]`. After the walk, every cell knows its upstream area.
 *  3. Identify sources (cells with flow >= threshold but no upstream feeder). Trace down
 *     descent[] emitting a polyline until flow drops below threshold or we leave land.
 *
 * Output coords are cell-center grid coords (cellX + 0.5, cellY + 0.5).
 */
import type { River } from './types';
export declare function traceRivers(heights: number[], cols: number, rows: number, minFlow: number): River[];
