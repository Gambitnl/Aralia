/**
 * GG-605 (2026-11-02): the heap router gives the same routes as the old scan.
 *
 * The old search picked its next node by a scan of every node, with the lowest
 * node id winning a tie. These tests keep a frozen copy of that search and of
 * its four-candidate route choice, and compare every door-to-door route of a
 * street grid where many routes tie (equal blocks), in two query orders, so
 * the resumed per-start searches are covered too.
 */
import { describe, expect, it } from 'vitest';
import { buildStreetGraph, routeAlongStreets, pathLength, type Point, type StreetGraph } from '../agentPath';
import type { TownPlan } from '../../artifacts';

// ---- Frozen pre-GG-605 router (agentPath.ts before 2026-11-02) ----------------
function linearDijkstra(graph: StreetGraph, start: number, goal: number): number[] {
  const n = graph.nodes.length;
  const dist = new Array<number>(n).fill(Infinity), prev = new Array<number>(n).fill(-1), done = new Array<boolean>(n).fill(false);
  dist[start] = 0;
  for (;;) {
    let current = -1, best = Infinity;
    for (let node = 0; node < n; node++) if (!done[node] && dist[node] < best) { best = dist[node]; current = node; }
    if (current === -1 || current === goal) break;
    done[current] = true;
    for (const e of graph.adj[current]) {
      const d = dist[current] + e.w;
      if (d < dist[e.to]) { dist[e.to] = d; prev[e.to] = current; }
    }
  }
  if (dist[goal] === Infinity && start !== goal) return [];
  const path: number[] = [];
  for (let node = goal; node !== -1; node = prev[node]) { path.push(node); if (node === start) break; }
  return path.reverse();
}
const same = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1e-6;
function compact(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) if (!out.length || !same(out[out.length - 1], p)) out.push(p);
  return out;
}
function project(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy;
  const t = l === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l));
  const q: Point = [a[0] + dx * t, a[1] + dy * t];
  return { point: q, d: Math.hypot(p[0] - q[0], p[1] - q[1]) };
}
function connection(graph: StreetGraph, p: Point) {
  for (const e of graph.plotEntrances.values()) {
    if (same(p, e.centroid) || same(p, e.door)) return { endpoint: e.door, streetPoint: e.streetPoint, seg: e.streetSegmentIndex };
  }
  let best: { point: Point; d: number; seg: number } | undefined;
  graph.segments.forEach((s, seg) => {
    const q = project(p, graph.nodes[s.fromNode], graph.nodes[s.toNode]);
    if (!best || q.d < best.d) best = { ...q, seg };
  });
  return best && { endpoint: p, streetPoint: best.point, seg: best.seg };
}
function referenceRoute(graph: StreetGraph, from: Point, to: Point): Point[] {
  if (graph.segments.length === 0) return [from, to];
  const a = connection(graph, from), b = connection(graph, to);
  if (!a || !b) return [from, to];
  if (same(a.endpoint, b.endpoint)) return [a.endpoint, b.endpoint];
  const candidates: Point[][] = [];
  const sa = graph.segments[a.seg], sb = graph.segments[b.seg];
  if (a.seg === b.seg) candidates.push(compact([a.streetPoint, b.streetPoint]));
  for (const f of [sa.fromNode, sa.toNode]) for (const t of [sb.fromNode, sb.toNode]) {
    const nodes = linearDijkstra(graph, f, t);
    if (nodes.length) candidates.push(compact([a.streetPoint, ...nodes.map((n) => graph.nodes[n]), b.streetPoint]));
  }
  let best: Point[] | undefined, bestLength = Infinity;
  for (const c of candidates) {
    const full = compact([a.endpoint, ...c, b.endpoint]), length = pathLength(full);
    if (length < bestLength) { bestLength = length; best = full; }
  }
  return best ?? [from, to];
}
// ---------------------------------------------------------------------------------

/** A 7 x 7 street grid of equal 100 ft blocks (many equal-length routes), a
 * diagonal avenue, and two houses on each block face. */
function gridTown(): TownPlan {
  const streets: Array<{ id: number; widthFt: number; centerline: Point[] }> = [];
  let id = 1;
  for (let k = 0; k <= 6; k++) {
    streets.push({ id: id++, widthFt: 10, centerline: Array.from({ length: 7 }, (_, i) => [i * 100, k * 100] as Point) });
    streets.push({ id: id++, widthFt: 10, centerline: Array.from({ length: 7 }, (_, i) => [k * 100, i * 100] as Point) });
  }
  streets.push({ id: id++, widthFt: 12, centerline: [[0, 0], [300, 300], [600, 600]] });
  const plots: Array<{ id: number; role: string; footprint: Point[] }> = [];
  let plotId = 1;
  for (let bx = 0; bx < 6; bx++) for (let by = 0; by < 6; by++) {
    const x = bx * 100, y = by * 100;
    for (const [ox, oy] of [[20, 10], [60, 70]] as const) {
      plots.push({ id: plotId++, role: 'house', footprint: [[x + ox, y + oy], [x + ox + 16, y + oy], [x + ox + 16, y + oy + 14], [x + ox, y + oy + 14]] });
    }
  }
  return { burgId: 1, streets, plots } as unknown as TownPlan;
}

describe('heap router parity (GG-605)', () => {
  const plan = gridTown();
  const centroids = (graph: StreetGraph) => [...graph.plotEntrances.values()].map((e) => e.centroid);

  it('routes every door pair exactly as the old linear search did', () => {
    const graph = buildStreetGraph(plan);
    const doors = centroids(graph);
    let routes = 0;
    for (const a of doors) for (const b of doors) {
      expect(routeAlongStreets(graph, a, b)).toEqual(referenceRoute(graph, a, b));
      routes++;
    }
    expect(routes).toBe(72 * 72);
  });

  it('gives the same routes when the per-start searches are resumed in another order', () => {
    const graph = buildStreetGraph(plan);
    const doors = centroids(graph);
    // A fixed shuffle: later goals reuse searches that stopped at earlier goals.
    const order = doors.map((_, i) => (i * 37) % doors.length);
    for (const i of order) for (const j of [...order].reverse()) {
      expect(routeAlongStreets(graph, doors[i], doors[j])).toEqual(referenceRoute(graph, doors[i], doors[j]));
    }
  });

  it('snaps free points and keeps a disconnected street honest', () => {
    const island = { ...plan, streets: [...plan.streets, { id: 99, widthFt: 8, centerline: [[900, 900], [1000, 900]] }] } as unknown as TownPlan;
    const graph = buildStreetGraph(island);
    const points: Point[] = [[5, 7], [333, 451], [950, 905], [612, 18], [250, 250]];
    for (const a of points) for (const b of points) expect(routeAlongStreets(graph, a, b)).toEqual(referenceRoute(graph, a, b));
  });
});
