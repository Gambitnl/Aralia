/**
 * @file agentPath.ts
 * @description Street-network pathing for town agents — so a commuter walks the
 * streets between home and work instead of teleporting between plot centroids.
 *
 * Pure geometry, renderer-agnostic: build a graph from the town plan's street
 * centerlines (shared/coincident vertices become intersections), then shortest-
 * path between two points snapped onto that graph. `positionAlongPath` lets a
 * caller place an agent partway along the route by a 0–1 progress value, which
 * is how the live layer will animate a commute across its scheduled window.
 *
 * Deterministic: graph construction and Dijkstra are order-stable (insertion
 * order + id tiebreaks), so the same plan + endpoints → the same polyline.
 */

import type { TownPlan } from '../artifacts';

export type Point = [number, number];

export interface StreetGraph {
  /** Node positions, index = node id. */
  nodes: Point[];
  /** Adjacency: adj[i] = [{ to, w }] undirected edges with Euclidean length. */
  adj: Array<Array<{ to: number; w: number }>>;
}

/** Quantize a coord to merge near-coincident street vertices into one node. */
const QUANT_FT = 1;
const keyOf = (p: Point): string => `${Math.round(p[0] / QUANT_FT)},${Math.round(p[1] / QUANT_FT)}`;
const dist = (a: Point, b: Point): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Build an undirected street graph from a town plan's street centerlines. */
export function buildStreetGraph(plan: TownPlan): StreetGraph {
  const nodes: Point[] = [];
  const adj: StreetGraph['adj'] = [];
  const index = new Map<string, number>();

  const nodeFor = (p: Point): number => {
    const k = keyOf(p);
    let i = index.get(k);
    if (i === undefined) {
      i = nodes.length;
      nodes.push(p);
      adj.push([]);
      index.set(k, i);
    }
    return i;
  };

  const link = (a: number, b: number, w: number): void => {
    if (a === b) return;
    if (!adj[a].some((e) => e.to === b)) adj[a].push({ to: b, w });
    if (!adj[b].some((e) => e.to === a)) adj[b].push({ to: a, w });
  };

  // Streets carry stable ids; sort so graph construction is order-independent.
  const streets = [...plan.streets].sort((s1, s2) => s1.id - s2.id);
  for (const street of streets) {
    const line = street.centerline;
    for (let i = 1; i < line.length; i++) {
      const a = nodeFor(line[i - 1]);
      const b = nodeFor(line[i]);
      link(a, b, dist(line[i - 1], line[i]));
    }
  }
  return { nodes, adj };
}

/** Nearest graph node to a point (linear scan; towns are small). -1 if empty. */
export function nearestNode(graph: StreetGraph, p: Point): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    const d = dist(graph.nodes[i], p);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Dijkstra node-path from `start` to `goal`; [] if unreachable. */
function dijkstra(graph: StreetGraph, start: number, goal: number): number[] {
  const n = graph.nodes.length;
  const distTo = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  distTo[start] = 0;

  for (;;) {
    // Pick the nearest unfinished node (linear PQ; fine for town-scale graphs).
    let u = -1;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      if (!done[i] && distTo[i] < best) {
        best = distTo[i];
        u = i;
      }
    }
    if (u === -1 || u === goal) break;
    done[u] = true;
    for (const { to, w } of graph.adj[u]) {
      const nd = distTo[u] + w;
      if (nd < distTo[to]) {
        distTo[to] = nd;
        prev[to] = u;
      }
    }
  }

  if (distTo[goal] === Infinity && start !== goal) return [];
  const path: number[] = [];
  for (let at = goal; at !== -1; at = prev[at]) {
    path.push(at);
    if (at === start) break;
  }
  return path.reverse();
}

/**
 * A walking polyline from `from` to `to` along the streets: snaps both ends to
 * the nearest street node, routes between them, and brackets the result with the
 * true endpoints (the plot centroids), so the path leaves the door and arrives
 * at the destination. Falls back to a straight [from, to] if the graph is empty
 * or the nodes are unreachable.
 */
export function routeAlongStreets(graph: StreetGraph, from: Point, to: Point): Point[] {
  if (graph.nodes.length === 0) return [from, to];
  const a = nearestNode(graph, from);
  const b = nearestNode(graph, to);
  if (a === -1 || b === -1) return [from, to];
  const nodePath = dijkstra(graph, a, b);
  if (nodePath.length === 0) return [from, to];
  return [from, ...nodePath.map((i) => graph.nodes[i]), to];
}

/** Total length of a polyline. */
export function pathLength(path: Point[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) len += dist(path[i - 1], path[i]);
  return len;
}

/**
 * Point at progress `t` (0–1) along a polyline by arc length. t<=0 → start,
 * t>=1 → end. Used to animate an agent across its commute window.
 */
export function positionAlongPath(path: Point[], t: number): Point {
  if (path.length === 0) return [0, 0];
  if (path.length === 1 || t <= 0) return path[0];
  const total = pathLength(path);
  if (t >= 1 || total === 0) return path[path.length - 1];
  let target = t * total;
  for (let i = 1; i < path.length; i++) {
    const seg = dist(path[i - 1], path[i]);
    if (target <= seg) {
      const f = seg === 0 ? 0 : target / seg;
      return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * f, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * f];
    }
    target -= seg;
  }
  return path[path.length - 1];
}
