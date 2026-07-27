/**
 * @file submapTravelGraph.ts — adapt an SP1 `SubmapModel` to a `TravelGraph`.
 *
 * Brings the submap drill tiers (region / local / locale) into the same travel
 * system as the atlas: the route planner can plan fastest routes over a submap's
 * Voronoi cells. Cell adjacency is derived from shared polygon edges (the model
 * doesn't store a neighbor list); terrain/danger come from each cell's sub-biome.
 *
 * Pure: no React/DOM. Cell ids are indices into `model.cells`.
 */
import type { SubmapModel, SubmapCell } from '../submap/submapEngine';
import type { TravelGraph } from '../../travel/routePlanning';
/** Adjacency for submap cells: two cells neighbor iff they share a polygon edge. */
export declare function buildSubmapAdjacency(cells: SubmapCell[]): number[][];
/** Build a `TravelGraph` over a submap's Voronoi cells (ids = indices into model.cells). */
export declare function buildSubmapTravelGraph(model: SubmapModel): TravelGraph;
