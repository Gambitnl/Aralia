/**
 * @file routePlanning.ts — fastest-route pathfinding + travel-cost model.
 *
 * Tier-agnostic: it plans a route over ANY cell graph (the Worldforge atlas
 * Voronoi cells, a submap's cells, or the legacy tile grid) via a small
 * `TravelGraph` adapter. Edge cost is real travel TIME, derived from distance ×
 * terrain (road/trail/open/difficult, reusing `TERRAIN_TRAVEL_MODIFIERS`) ÷ the
 * chosen transport's speed. The planner returns the fastest route, its total
 * time/distance, and an aggregate danger rating — everything the map UI needs to
 * draw the path line, preview travel time, and roll for encounters.
 *
 * Pure: no React/DOM. Reuses `src/types/travel.ts` (terrain modifiers, vehicles).
 */
import {
  TERRAIN_TRAVEL_MODIFIERS,
  type TravelTerrain,
  type TransportOption,
} from '../../types/travel';

/** A cell graph the planner can route over (one adapter per map tier). */
export interface TravelGraph {
  /** Adjacent cell ids of `cell`. */
  neighbors(cell: number): number[];
  /** Cell centroid in the tier's coordinate space (graph units). */
  position(cell: number): [number, number];
  /** Travel terrain class of entering `cell` (road = fastest, difficult = half). */
  terrain(cell: number): TravelTerrain;
  /** Whether `cell` can be entered at all (false for ocean / impassable). */
  passable(cell: number): boolean;
  /** Per-cell danger in [0,1] (0 = safe). Optional; defaults to 0. */
  danger?(cell: number): number;
}

export interface RoutePlan {
  /** Cell ids from start to goal (inclusive). */
  cells: number[];
  /** Cell centroids along the route, for drawing the path line. */
  points: Array<[number, number]>;
  /** Total route distance in miles. */
  miles: number;
  /** Total travel time in minutes. */
  minutes: number;
  /** Aggregate danger rating in [0,1] (max of per-cell danger along the route). */
  danger: number;
}

export interface RoutePlanOptions {
  /** Graph-unit → mile scale for the tier (so time is in real units). */
  milesPerUnit: number;
  /** Effective transport speed in miles/hour (see transportSpeedMph). */
  speedMph: number;
}

/**
 * Effective travel speed (mph) for a transport option. Vehicle/mount `speed` is
 * D&D ft/round; ÷10 ≈ overland mph (30ft walk → 3mph; 60ft horse → 6mph). A
 * puller-limited vehicle (speed 0, e.g. cart/wagon) falls back to ~2mph.
 */
export function transportSpeedMph(transport?: TransportOption | null): number {
  const WALK_MPH = 3;
  if (!transport || transport.method === 'walking') return WALK_MPH;
  const raw = transport.vehicle?.speed ?? 0;
  if (raw <= 0) return 2; // puller-limited cart/wagon
  return raw / 10;
}

function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Minimal binary min-heap keyed by number priority. */
class MinHeap {
  private h: Array<{ k: number; p: number }> = [];
  get size(): number { return this.h.length; }
  push(k: number, p: number): void {
    const h = this.h;
    h.push({ k, p });
    let i = h.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (h[par].p <= h[i].p) break;
      [h[par], h[i]] = [h[i], h[par]];
      i = par;
    }
  }
  pop(): number {
    const h = this.h;
    const top = h[0];
    const last = h.pop()!;
    if (h.length > 0) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let s = i;
        if (l < h.length && h[l].p < h[s].p) s = l;
        if (r < h.length && h[r].p < h[s].p) s = r;
        if (s === i) break;
        [h[s], h[i]] = [h[i], h[s]];
        i = s;
      }
    }
    return top.k;
  }
}

/**
 * Single-source travel field: fastest-time distances from `start` to every
 * reachable cell, plus a `to(goal)` reconstructor. Compute this ONCE per origin
 * (and transport), then resolve a route to any hovered cell instantly — the key
 * to a responsive travel-mode route preview over a large cell graph (no repeated
 * Dijkstra per mouse-move).
 */
export interface RouteField {
  start: number;
  /** Minutes from `start` to each reached cell. */
  dist: Map<number, number>;
  prev: Map<number, number>;
  /** Reconstruct the fastest route to `goal`, or null if it is unreachable/impassable. */
  to(goal: number): RoutePlan | null;
}

/** Run Dijkstra from `start` over the whole reachable (passable) graph. */
export function planRoutesFrom(graph: TravelGraph, start: number, opts: RoutePlanOptions): RouteField {
  const speed = Math.max(0.1, opts.speedMph);
  const minutesOf = (from: number, to: number): number => {
    const miles = dist(graph.position(from), graph.position(to)) * opts.milesPerUnit;
    const terrainMod = TERRAIN_TRAVEL_MODIFIERS[graph.terrain(to)] || 1;
    return (miles / (speed * terrainMod)) * 60;
  };

  const best = new Map<number, number>([[start, 0]]);
  const prev = new Map<number, number>();
  const heap = new MinHeap();
  heap.push(start, 0);
  const settled = new Set<number>();
  while (heap.size > 0) {
    const cur = heap.pop();
    if (settled.has(cur)) continue;
    settled.add(cur);
    const curCost = best.get(cur)!;
    for (const nb of graph.neighbors(cur)) {
      if (!graph.passable(nb)) continue;
      const nc = curCost + minutesOf(cur, nb);
      if (nc < (best.get(nb) ?? Infinity)) {
        best.set(nb, nc);
        prev.set(nb, cur);
        heap.push(nb, nc);
      }
    }
  }

  const to = (goal: number): RoutePlan | null => {
    if (goal === start) {
      return { cells: [start], points: [graph.position(start)], miles: 0, minutes: 0, danger: graph.danger?.(start) ?? 0 };
    }
    if (!graph.passable(goal) || !best.has(goal)) return null;
    const cells: number[] = [];
    for (let c: number | undefined = goal; c != null; c = prev.get(c)) {
      cells.push(c);
      if (c === start) break;
    }
    cells.reverse();
    let miles = 0;
    let danger = graph.danger?.(start) ?? 0;
    const points: Array<[number, number]> = [graph.position(start)];
    for (let i = 1; i < cells.length; i++) {
      miles += dist(graph.position(cells[i - 1]), graph.position(cells[i])) * opts.milesPerUnit;
      points.push(graph.position(cells[i]));
      danger = Math.max(danger, graph.danger?.(cells[i]) ?? 0);
    }
    return { cells, points, miles, minutes: best.get(goal)!, danger };
  };

  return { start, dist: best, prev, to };
}

/**
 * Plan the fastest (least-time) route from `start` to `goal`. Convenience wrapper
 * over `planRoutesFrom` for one-off point-to-point queries; for travel-mode hover
 * previews prefer `planRoutesFrom` once + `field.to(cell)` per hover.
 */
export function planFastestRoute(
  graph: TravelGraph,
  start: number,
  goal: number,
  opts: RoutePlanOptions,
): RoutePlan | null {
  return planRoutesFrom(graph, start, opts).to(goal);
}
