/**
 * @file townSnapshot.ts
 * @description Bridges the occupant schedule (WHEN/what) to town space (WHERE):
 * given a town plan, its roster, and an hour, returns every occupant's activity
 * AND concrete position (the centroid of the plot the schedule puts them at).
 *
 * Still pure data — `hour` is a parameter, not a live clock — so a renderer,
 * debug overlay, or future needs/economy sim can ask "who is where, doing what,
 * at hour H?" and get one deterministic answer. This is the layer a 3D agent
 * placement pass consumes; it owns no rendering and no time source.
 */

import type { TownPlan } from '../artifacts';
import type { Occupant, TownRoster, TownPlot } from './types';
import { occupantLocationAt, type ActivityKind } from './occupantSchedule';
import { routeAlongStreets, positionAlongPath, type StreetGraph, type Point } from './agentPath';

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

/**
 * Fraction of an hour an agent spends walking the streets after their scheduled
 * plot changes (a plot flip at the hour boundary = a commute). For the first
 * `COMMUTE_FRAC` of that hour they interpolate along the street route from the
 * previous plot to the new one; afterward they're settled at the destination.
 */
const COMMUTE_FRAC = 0.5;

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
    const dest = centroids.get(cur.plotId);
    if (!dest) continue; // defensive: roster always references plan plots

    const prev = occupantLocationAt(occ, hr - 1);
    const from = prev.plotId !== cur.plotId ? centroids.get(prev.plotId) : undefined;
    if (from && frac < COMMUTE_FRAC) {
      // Walking the streets from the previous plot to the new one.
      const route = routeAlongStreets(graph, from as Point, dest as Point);
      const [x, y] = positionAlongPath(route, frac / COMMUTE_FRAC);
      out.push({ occupantId: occ.id, name: occ.name, activity: cur.activity, plotId: cur.plotId, x, y, moving: true });
    } else {
      // Settled at the scheduled plot's centroid.
      out.push({ occupantId: occ.id, name: occ.name, activity: cur.activity, plotId: cur.plotId, x: dest[0], y: dest[1], moving: false });
    }
  }
  return out;
}
