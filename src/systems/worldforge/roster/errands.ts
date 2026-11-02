/**
 * @file errands.ts
 * @description Where a townsperson goes during their OUT block.
 *
 * `occupantLocationAt` gives every non-worker one OUT block a day, but it keeps
 * `plotId` at home, because the interior schedule and other consumers read
 * "out" as "not in the house". Before this module the 3D street crowd drew
 * those people standing at their own front door for two to four hours (1,044
 * people at 13:00 in Borieborum, 2026-11-02). Nobody walked anywhere.
 *
 * This module answers one extra question for the motion layer only: "which
 * public building does this person walk to for their errand?". The answer is a
 * plot id whose entrance is on the same street graph, so the existing router
 * (`routeAlongStreets`) walks them door to door. The schedule itself does not
 * change.
 *
 * Determinism: the choice is a pure function of the street graph (its plot
 * entrances and their roles) and the occupant's id, home plot and age band. It
 * reads no RNG and no plan, so the street crowd, the interior arrival gate and
 * door use all pick the same destination from the same graph.
 */

import type { Occupant } from './types';
import type { StreetGraph, Point } from './agentPath';

/** Plot roles a person can walk to on an errand, with a weight per age band. */
const ROLE_WEIGHTS: Record<'child' | 'adult' | 'elder', Record<string, number>> = {
  // Children follow errands to the market and play by the civic buildings.
  child: { market: 3, civic: 2, temple: 1, workshop: 1 },
  // Adults mostly shop; some visit a workshop or the temple.
  adult: { market: 6, workshop: 3, temple: 2, civic: 1 },
  // Elders split their time between the market and the temple.
  elder: { market: 4, temple: 4, civic: 1, workshop: 1 },
};

export const ERRAND_ROLES = ['market', 'workshop', 'temple', 'civic'] as const;

/** Prefer a place within this walk (straight line, feet): about 400 m. */
const NEAR_ERRAND_FT = 1300;
/** Choose among this many of the nearest places of the chosen role. Raised
 * from 4: one market door drew 110 of 2,109 people (2026-11-02). */
const NEAREST_PER_ROLE = 8;

/** Small stable hash (same mixer as the schedule's id hash, with a salt). */
function hash(id: number, salt: number): number {
  let h = 2166136261 ^ id ^ Math.imul(salt, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

interface ErrandIndex {
  /** Entrances of each errand role, in plot-id order. */
  byRole: Map<string, Array<{ plotId: number; door: Point }>>;
  /** Cached choice per occupant id (null = no reachable errand place). */
  choice: Map<number, number | null>;
}

// The graph is immutable once built; retired towns release their index.
const indexByGraph = new WeakMap<StreetGraph, ErrandIndex>();

function errandIndex(graph: StreetGraph): ErrandIndex {
  const cached = indexByGraph.get(graph);
  if (cached) return cached;
  const byRole = new Map<string, Array<{ plotId: number; door: Point }>>();
  const entrances = [...graph.plotEntrances.values()].sort((a, b) => a.plotId - b.plotId);
  for (const entrance of entrances) {
    if (!entrance.role || !(ERRAND_ROLES as readonly string[]).includes(entrance.role)) continue;
    const list = byRole.get(entrance.role) ?? [];
    list.push({ plotId: entrance.plotId, door: entrance.door });
    byRole.set(entrance.role, list);
  }
  const index = { byRole, choice: new Map<number, number | null>() };
  indexByGraph.set(graph, index);
  return index;
}

/**
 * The public plot this occupant walks to during their OUT block, or undefined
 * when the graph has no errand place (a hamlet with no market, a hand-built
 * test graph, or a home with no street entrance).
 */
export function errandPlotFor(graph: StreetGraph, occupant: Occupant): number | undefined {
  const index = errandIndex(graph);
  const cached = index.choice.get(occupant.id);
  if (cached !== undefined) return cached ?? undefined;

  const home = graph.plotEntrances.get(occupant.homePlotId)?.door;
  let result: number | null = null;
  if (home) {
    // Nearest few places per role, nearest first. A role with nothing near
    // still offers its single nearest place, so a far market is not ignored.
    const near = new Map<string, number[]>();
    for (const [role, places] of index.byRole) {
      const ranked = places
        .filter((p) => p.plotId !== occupant.homePlotId)
        .map((p) => ({ plotId: p.plotId, d: Math.hypot(p.door[0] - home[0], p.door[1] - home[1]) }))
        .sort((a, b) => a.d - b.d || a.plotId - b.plotId);
      const inRange = ranked.filter((p) => p.d <= NEAR_ERRAND_FT).slice(0, NEAREST_PER_ROLE);
      const pick = inRange.length ? inRange : ranked.slice(0, 1);
      if (pick.length) near.set(role, pick.map((p) => p.plotId));
    }
    const weights = ROLE_WEIGHTS[occupant.ageBand as keyof typeof ROLE_WEIGHTS] ?? ROLE_WEIGHTS.adult;
    // Roles in a fixed order, so the roll does not depend on Map insertion.
    const roles = ERRAND_ROLES.filter((r) => near.has(r) && (weights[r] ?? 0) > 0);
    const total = roles.reduce((s, r) => s + weights[r], 0);
    if (total > 0) {
      let roll = hash(occupant.id, 1) % total;
      let role: string = roles[roles.length - 1];
      for (const r of roles) {
        roll -= weights[r];
        if (roll < 0) { role = r; break; }
      }
      const options = near.get(role)!;
      result = options[hash(occupant.id, 2) % options.length];
    }
  }
  index.choice.set(occupant.id, result);
  return result ?? undefined;
}
