/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 18/07/2026, 18:54:58
 * Dependents: components/Worldforge/AgentSimPreview.tsx, components/Worldforge/TownAgentSnapshotView.tsx, systems/worldforge/bridge/groundAgentMotion.ts, systems/worldforge/roster/townSnapshot.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file agentPath.ts
 * @description Builds believable walking routes between town buildings.
 *
 * The roster and preview layers know which plot an agent is leaving and which
 * plot they are visiting, but they deliberately do not own street geometry.
 * This file turns a town plan into a reusable street graph, places one entrance
 * at the middle of every building wall that faces the street network, and walks
 * agents entrance-to-entrance through the nearest points on those streets.
 *
 * Called by: AgentSimPreview and townSnapshot.
 * Depends on: the generated TownPlan's plot footprints and street centerlines.
 *
 * The calculations are pure and order-stable. The same plan and endpoints
 * therefore produce the same route, including when two routes have equal cost.
 */
import type { TownPlan } from '../artifacts';
export type Point = [number, number];
export interface StreetSegment {
    /** Graph node at the first end of this walkable street span. */
    fromNode: number;
    /** Graph node at the second end of this walkable street span. */
    toNode: number;
}
export interface PlotEntrance {
    /** Stable plot identity from the town plan. */
    plotId: number;
    /** Plot centre used by existing roster and preview callers. */
    centroid: Point;
    /** Midpoint of the building wall that faces the closest street. */
    door: Point;
    /** Closest walkable point on that street's centreline. */
    streetPoint: Point;
    /** Segment carrying streetPoint. */
    streetSegmentIndex: number;
    /** Short doorway-to-street approach, in feet. */
    connectorLengthFt: number;
}
export interface StreetGraph {
    /** Node positions, index = node id. */
    nodes: Point[];
    /** Undirected walkable links with their length in feet. */
    adj: Array<Array<{
        to: number;
        w: number;
    }>>;
    /** Individual spans preserve where an entrance joins between graph nodes. */
    segments: StreetSegment[];
    /** Street-facing entrance receipt for every plot that has usable geometry. */
    plotEntrances: Map<number, PlotEntrance>;
}
/** Build an undirected street graph and one street-facing entrance per plot. */
export declare function buildStreetGraph(plan: TownPlan): StreetGraph;
/** Read the canonical street-facing door for a plot, if its plan had streets. */
export declare function frontDoorForPlot(graph: StreetGraph, plotId: number): Point | undefined;
/** Nearest graph vertex to a point. Retained for diagnostics and legacy callers. */
export declare function nearestNode(graph: StreetGraph, point: Point): number;
/**
 * Build a door-to-door walking polyline through the street network.
 *
 * Known plot centroids are replaced by their street-facing wall entrances.
 * Each entrance joins the nearest point on a street span, the shortest network
 * route connects those projections, and the final connector reaches the other
 * door. With no usable or connected streets, callers retain the safe straight
 * fallback between the positions they supplied.
 */
export declare function routeAlongStreets(graph: StreetGraph, from: Point, to: Point): Point[];
/** Total length of a walking polyline, in feet. */
export declare function pathLength(path: Point[]): number;
/**
 * Sample progress from 0 to 1 along a walking route by travelled distance.
 * Values below or above that range stay at the corresponding endpoint.
 */
export declare function positionAlongPath(path: Point[], progress: number): Point;
