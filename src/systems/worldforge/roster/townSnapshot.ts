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
