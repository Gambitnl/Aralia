/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 19:32:31
 * Dependents: components/Worldforge/TownAgentSnapshotView.tsx, systems/worldforge/bridge/groundAgentMotion.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file townSnapshot.ts
 * @description Bridges the occupant schedule (WHEN/what) to town space (WHERE):
 * given a town plan, its roster, and an hour, returns every occupant's activity
 * AND concrete position. Point-in-time snapshots use plot centroids, while
 * motion snapshots use the street graph's canonical doors whenever available
 * so starting a route, finishing it, and waiting at a building share one point.
 *
 * Still pure data — `hour` is a parameter, not a live clock — so a renderer,
 * debug overlay, or future needs/economy sim can ask "who is where, doing what,
 * at hour H?" and get one deterministic answer. This is the layer a 3D agent
 * placement pass consumes; it owns no rendering and no time source.
 */
import type { TownPlan } from '../artifacts';
import type { TownRoster } from './types';
import { type ActivityKind } from './occupantSchedule';
import { type StreetGraph } from './agentPath';
export interface AgentSnapshot {
    occupantId: number;
    name: string;
    activity: ActivityKind;
    /** The plot they are at this hour (home or work). */
    plotId: number;
    /** World position: the centroid of that plot's footprint (town/graph coords). */
    x: number;
    y: number;
}
/**
 * Every occupant's activity + position at `hour` (0–23). Occupants whose
 * scheduled plot is missing from the plan are skipped (defensive; a roster
 * always references plan plots). Deterministic and pure.
 */
export declare function townSnapshotAt(plan: TownPlan, roster: TownRoster, hour: number): AgentSnapshot[];
/** Count of occupants by activity at `hour` — a cheap town-rhythm read. */
export declare function activityTallyAt(plan: TownPlan, roster: TownRoster, hour: number): Record<ActivityKind, number>;
/** An agent placed with continuous (possibly in-transit) motion. */
export interface MovingAgentSnapshot extends AgentSnapshot {
    /** True while the agent is walking a street route between two plots. */
    moving: boolean;
}
/**
 * Like `townSnapshotAt`, but at a FRACTIONAL `clock` (hours, e.g. 7.5) and with
 * continuous positions: an agent whose scheduled plot just changed walks the
 * street route between the two plots (via `routeAlongStreets`/`positionAlongPath`)
 * across the commute window instead of teleporting at the boundary. The town
 * feels alive — people are seen moving between home and work — while staying pure
 * and deterministic. Build the `graph` once with `buildStreetGraph(plan)`.
 */
export declare function townMotionSnapshotAt(plan: TownPlan, graph: StreetGraph, roster: TownRoster, clock: number): MovingAgentSnapshot[];
