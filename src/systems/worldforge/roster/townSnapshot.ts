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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/10/2026, 02:07:12
 * Dependents: components/World3D/residentDoorUse.ts, components/Worldforge/TownAgentSnapshotView.tsx, systems/worldforge/bridge/groundAgentMotion.ts, systems/worldforge/bridge/residentDoorRoutes.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { TownPlan } from '../artifacts';
import type { Occupant, TownRoster, TownPlot } from './types';
import { occupantLocationAt, type ActivityKind } from './occupantSchedule';
import {
  frontDoorForPlot,
  routeAlongStreets,
  positionAlongPath,
  pathLength,
  type StreetGraph,
  type Point,
} from './agentPath';

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

function centroidOf(plot: TownPlot): [number, number] {
  const sum = plot.footprint.reduce<[number, number]>(
    (acc, p) => [acc[0] + p[0], acc[1] + p[1]],
    [0, 0],
  );
  const n = plot.footprint.length || 1;
  return [sum[0] / n, sum[1] / n];
}

/**
 * Every occupant's activity + position at `hour` (0–23). Occupants whose
 * scheduled plot is missing from the plan are skipped (defensive; a roster
 * always references plan plots). Deterministic and pure.
 */
export function townSnapshotAt(
  plan: TownPlan,
  roster: TownRoster,
  hour: number,
): AgentSnapshot[] {
  const centroids = new Map<number, [number, number]>();
  for (const plot of plan.plots) centroids.set(plot.id, centroidOf(plot));

  const out: AgentSnapshot[] = [];
  for (const occ of roster.occupants as Occupant[]) {
    const block = occupantLocationAt(occ, hour);
    const c = centroids.get(block.plotId);
    if (!c) continue;
    out.push({
      occupantId: occ.id,
      name: occ.name,
      activity: block.activity,
      plotId: block.plotId,
      x: c[0],
      y: c[1],
    });
  }
  return out;
}

/** Count of occupants by activity at `hour` — a cheap town-rhythm read. */
export function activityTallyAt(
  plan: TownPlan,
  roster: TownRoster,
  hour: number,
): Record<ActivityKind, number> {
  const tally: Record<ActivityKind, number> = { sleeping: 0, home: 0, working: 0, out: 0 };
  for (const a of townSnapshotAt(plan, roster, hour)) tally[a.activity]++;
  return tally;
}

/** An agent placed with continuous (possibly in-transit) motion. */
export interface MovingAgentSnapshot extends AgentSnapshot {
  /** True while the agent is walking a street route between two plots. */
  moving: boolean;
}

/** Legacy preview-only commute window. Named household people instead use
 * measured route length at the shared walking speed. The same duration feeds
 * the street position and the room body's arrival gate. */
const COMMUTE_FRAC = 0.5;
export const TOWN_WALK_METERS_PER_SECOND = 1.2;

/** Latest change to the current destination, including travel across hours. */
export function recentCommute(occupant: Occupant, hour: number) {
  const current = occupantLocationAt(occupant, hour);
  for (let elapsed = 0; elapsed < 24; elapsed++) {
    const previous = occupantLocationAt(occupant, hour - elapsed - 1);
    if (previous.plotId !== current.plotId) return { from: previous.plotId, to: current.plotId, elapsed };
  }
  return undefined;
}

function routeHours(graph: StreetGraph, occupant: Occupant, fromId: number, toId: number): number {
  // Source household people walk the real route at the indoor body's speed.
  // Legacy preview people retain their established timing until unified.
  if (!occupant.householdMemberId) return COMMUTE_FRAC;
  const from = frontDoorForPlot(graph, fromId), to = frontDoorForPlot(graph, toId);
  if (!from || !to) return COMMUTE_FRAC;
  return pathLength(scheduledRoute(graph, fromId, toId, from, to)) * 0.3048 / TOWN_WALK_METERS_PER_SECOND / 3600;
}

/** Time still owed outside from the start of this hour. A room cannot claim
 * the resident until this measured door-to-door street leg has arrived. */
export function commuteArrivalDelayAtHour(graph: StreetGraph, occupant: Occupant, hour: number): number {
  const leg = recentCommute(occupant, hour);
  return leg ? Math.max(0, routeHours(graph, occupant, leg.from, leg.to) - leg.elapsed) : 0;
}

// A generated graph and its plot doors are immutable. Scheduled commuters ask
// for the same directed plot-to-plot paths on every motion tick, so retain those
// polylines with the graph that owns them. Callers only sample these arrays;
// none mutate them, and WeakMap ownership lets retired towns be collected.
const scheduledRoutesByGraph = new WeakMap<StreetGraph, Map<string, Point[]>>();

function scheduledRoute(
  graph: StreetGraph,
  fromPlotId: number,
  toPlotId: number,
  from: Point,
  to: Point,
): Point[] {
  let routes = scheduledRoutesByGraph.get(graph);
  if (!routes) {
    routes = new Map();
    scheduledRoutesByGraph.set(graph, routes);
  }

  const key = `${fromPlotId}>${toPlotId}`;
  const cached = routes.get(key);
  if (cached) return cached;

  const route = routeAlongStreets(graph, from, to);
  routes.set(key, route);
  return route;
}

/** Keep a known building endpoint at its door; legacy/no-street plans retain their centroid. */
function settledPointForPlot(
  graph: StreetGraph,
  plotId: number,
  centroid: Point,
): Point {
  return frontDoorForPlot(graph, plotId) ?? centroid;
}

/**
 * Like `townSnapshotAt`, but at a FRACTIONAL `clock` (hours, e.g. 7.5) and with
 * continuous positions: an agent whose scheduled plot just changed walks the
 * street route between the two plots (via `routeAlongStreets`/`positionAlongPath`)
 * across the commute window instead of teleporting at the boundary. The town
 * feels alive — people are seen moving between home and work — while staying pure
 * and deterministic. Build the `graph` once with `buildStreetGraph(plan)`.
 */
export function townMotionSnapshotAt(
  plan: TownPlan,
  graph: StreetGraph,
  roster: TownRoster,
  clock: number,
): MovingAgentSnapshot[] {
  const centroids = new Map<number, [number, number]>();
  for (const plot of plan.plots) centroids.set(plot.id, centroidOf(plot));

  const wrapped = ((clock % 24) + 24) % 24;
  const hr = Math.floor(wrapped);
  const frac = wrapped - hr;

  const out: MovingAgentSnapshot[] = [];
  for (const occ of roster.occupants as Occupant[]) {
    const cur = occupantLocationAt(occ, hr);
    const destCentroid = centroids.get(cur.plotId);
    if (!destCentroid) continue; // defensive: roster always references plan plots
    const dest = settledPointForPlot(graph, cur.plotId, destCentroid);

    const leg = recentCommute(occ, hr);
    const fromCentroid = leg ? centroids.get(leg.from) : undefined;
    const from = fromCentroid
      ? settledPointForPlot(graph, leg!.from, fromCentroid)
      : undefined;
    const duration = leg ? routeHours(graph, occ, leg.from, leg.to) : 0;
    const elapsed = (leg?.elapsed ?? 0) + frac;
    if (from && duration > 0 && elapsed < duration) {
      // Both route ends are already canonical doors. This prevents the first
      // frame from popping centroid-to-door before the street walk begins.
      const route = scheduledRoute(graph, leg!.from, cur.plotId, from as Point, dest as Point);
      const [x, y] = positionAlongPath(route, elapsed / duration);
      out.push({ occupantId: occ.id, name: occ.name, activity: cur.activity, plotId: cur.plotId, x, y, moving: true });
    } else {
      // Remain at the route's destination door after arrival. Plans without a
      // usable entrance preserve their historical centroid fallback.
      out.push({ occupantId: occ.id, name: occ.name, activity: cur.activity, plotId: cur.plotId, x: dest[0], y: dest[1], moving: false });
    }
  }
  return out;
}
