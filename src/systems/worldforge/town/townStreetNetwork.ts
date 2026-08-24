// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/08/2026, 00:54:20
 * Dependents: components/Worldforge/TownPlanView.tsx, systems/worldforge/town/townEngine.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file townStreetNetwork.ts — the ONE generated street network of a town.
 *
 * WHY THIS EXISTS (roads slice, 2026-08-23). Before this module a town had no
 * street network at all. It had two unrelated things:
 *
 *  1. `plan.streets` — the inherited regional roads, clipped to the CELL. They
 *     drove straight over the wall, over the wards, and over the market square,
 *     then stopped wherever the clip ended. They never met a gatehouse, because
 *     gatehouses were seated at the midpoints of the longest footprint edges and
 *     knew nothing about roads.
 *  2. The GAPS between ward blocks. Every ward shrank by ONE uniform margin, so
 *     the leftover gaps read as streets — every one of them the same width,
 *     whatever it served. The 2D map drew no street at all: it drew the gap.
 *
 * The 3D side then invented a hierarchy the plan did not have (`townPlanAdapter`
 * tiered ward edges by the bordering ward's civic role), so the 2D map showed a
 * flat uniform grid while 3D showed four tiers of the same lines. Same plan, two
 * different towns.
 *
 * This module replaces both halves with one network, generated once in the
 * engine and carried on the plan, so every renderer draws the SAME streets at
 * the SAME widths:
 *
 *   • GATES FIRST. A gatehouse is seated where an approach road actually meets
 *     the wall ring (see `roadGateCandidates`), so roads and gates agree.
 *   • THE SPINE IS ROUTED, NOT BULLDOZED. Each gate is joined to the town's
 *     heart (the market square, else the town center) by a shortest path over
 *     the ward-edge graph. The main street therefore follows the blocks, the
 *     way a real high street does, instead of cutting a diagonal through them.
 *   • TIER FOLLOWS TRAFFIC. Every gate→heart and gate→gate route is counted per
 *     edge. An edge carrying many routes is an avenue; one route makes it a
 *     street; the rest are back lanes. This is why the hierarchy reads as a
 *     town: the wide streets are the ones you would actually walk.
 *   • ONE WIDTH. Each street carries its full paved `width` in PLAN UNITS. The
 *     engine insets each ward block by the HALF-WIDTH of that block's own edges,
 *     so the gap the generator leaves is exactly the ribbon the renderers paint.
 *     No renderer may invent a width any more.
 *
 * Pure numbers only — no three.js, no React, and NO import of `townEngine`
 * (which imports this module). Tint/layer recipes stay in `streetRibbons.ts`;
 * this module decides geometry and tier, that one decides paint.
 */
import type { Pt } from '../submap/submapEngine';
import { STREET_TIER_SPECS, STREET_TIER_ORDER, type StreetTierName } from './streetRibbons';

/**
 * What a street DOES in the town, kept beside its visual tier because the two
 * answer different questions: `tier` decides how it is painted, `role` records
 * why it exists (and lets a renderer treat, say, the extramural approach
 * differently from the high street it becomes inside the gate).
 */
export type StreetRole =
  /** Outside the wall: the inherited regional road, trimmed to stop at its gate. */
  | 'approach'
  /** Gate → market square (or town center): the routed high street. */
  | 'spine'
  /** Carries at least one through-route between gates. */
  | 'through'
  /** The intervallum lane just inside the wall ring. */
  | 'ring'
  /** Plain ward frontage — the back lanes. */
  | 'ward';

/** One street of the network, in the PLAN's own coordinate frame. */
export interface TownStreet {
  centerline: Pt[];
  tier: StreetTierName;
  role: StreetRole;
  /** Full paved width in plan units. The ward block inset is half of this. */
  width: number;
}

/**
 * Tier widths as MULTIPLES of the back lane. The absolute lane width stays the
 * engine's existing street margin, so this slice widens the hierarchy without
 * re-scaling every town: a lane keeps the width it always had and the busier
 * tiers grow above it. Ratios come from the shared feet ladder
 * (28/22/15/10 ft) so 2D, the 3D minimap and the game bake stay one hierarchy.
 */
export const TIER_WIDTH_RATIO: Record<StreetTierName, number> = {
  plaza: STREET_TIER_SPECS.plaza.widthFt / STREET_TIER_SPECS.lane.widthFt,
  avenue: STREET_TIER_SPECS.avenue.widthFt / STREET_TIER_SPECS.lane.widthFt,
  street: STREET_TIER_SPECS.street.widthFt / STREET_TIER_SPECS.lane.widthFt,
  lane: 1,
};

/**
 * Widest a street may be as a share of the SMALLER ward it runs beside. A ward
 * gives up half a street's width along each of its edges, so at 0.28 the tightest
 * block still keeps ~44% of its span to build on. Without a cap a plaza-tier
 * frontage swallowed the small wards behind a market square whole.
 */
const MAX_WARD_WIDTH_FRAC = 0.28;

/**
 * How much dearer an edge running flush against the wall is to route over, at
 * the rampart itself, fading to nothing a band's width inside. 1.6 means a
 * wall-hugging detour must be under ~38% of the length of the route through
 * town before it wins.
 */
const RING_ROUTE_PENALTY = 1.6;

/** Higher rank wins a shared ward edge (paved frontage beats dirt). */
const TIER_RANK: Record<StreetTierName, number> = { plaza: 3, avenue: 2, street: 1, lane: 0 };

/** Pick the better-paved of two tiers. */
function bestTier(a: StreetTierName, b: StreetTierName): StreetTierName {
  return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

export interface StreetNetworkInput {
  /** Voronoi ward polygons, BEFORE the block inset (their edges are the streets). */
  wardPolys: readonly Pt[][];
  /** Civic role per ward index, or undefined for a plain residential ward. */
  wardCivic: ReadonlyArray<string | undefined>;
  /** Wall ring, or an empty array for an unwalled settlement. */
  wallRing: readonly Pt[];
  /** Gatehouse points on the ring (already road-aligned by `buildWalls`). */
  gatehouses: readonly Pt[];
  /** Inherited regional roads in plan coords — the approaches. */
  approachRoads: readonly Pt[][];
  /** The town's build envelope (wall ring, else core) — used to find the heart. */
  envelope: readonly Pt[];
  /** Back-lane full width in plan units. Every other tier scales off this. */
  laneWidth: number;
}

/* ------------------------------------------------------------------ geometry */

const dist = (a: Pt, b: Pt): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

function polygonCentroidLocal(poly: readonly Pt[]): Pt {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const cross = x1 * y2 - x2 * y1;
    a += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(a) < 1e-12) {
    // Degenerate ring: fall back to the vertex mean so callers still get a point
    // inside the shape's hull rather than a NaN.
    const n = poly.length || 1;
    return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
  }
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}

function polygonSpan(poly: readonly Pt[]): number {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return Math.max(maxX - minX, maxY - minY) || 1;
}

/** Intersection point of segments p1p2 and p3p4, or null when they do not cross. */
export function segmentCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): Pt | null {
  const d1x = p2[0] - p1[0], d1y = p2[1] - p1[1];
  const d2x = p4[0] - p3[0], d2y = p4[1] - p3[1];
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / denom;
  const u = ((p3[0] - p1[0]) * d1y - (p3[1] - p1[1]) * d1x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [p1[0] + t * d1x, p1[1] + t * d1y];
}

/** Squared distance from p to segment ab — used to test "is this point on the ring". */
function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy;
  if (L2 < 1e-12) return dist(p, a);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Shortest distance from p to a closed polygon's boundary. */
function distToRing(p: Pt, ring: readonly Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const d = distToSegment(p, ring[i], ring[(i + 1) % ring.length]);
    if (d < best) best = d;
  }
  return best;
}

/** Standard even-odd point-in-polygon. */
function pointInPoly(p: Pt, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Points along a→b spaced at most `spacing` apart, both ends included. Long
 * streets need intermediate points so a draped renderer follows the ground
 * instead of spanning a bump as one flat plank.
 */
export function densifyPolyline(line: readonly Pt[], spacing: number): Pt[] {
  if (line.length < 2 || !(spacing > 0)) return line.map((p) => [p[0], p[1]] as Pt);
  const out: Pt[] = [[line[0][0], line[0][1]]];
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const steps = Math.max(1, Math.ceil(dist(a, b) / spacing));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/* --------------------------------------------------------------------- gates */

/**
 * Where the inherited roads actually meet the wall ring — the ONLY honest place
 * to put a gatehouse. Crossings closer together than `minSpacing` collapse to
 * one gate, so a road that wobbles across the ring twice does not grow a pair of
 * gates a few feet apart.
 *
 * Exported for `townEngine.buildWalls`, which seats these first and only then
 * tops the ring up with its longest-edge rule.
 */
export function roadGateCandidates(
  ring: readonly Pt[],
  roads: readonly Pt[][],
  minSpacing: number,
): Pt[] {
  const gates: Pt[] = [];
  for (const road of roads) {
    for (let s = 0; s < road.length - 1; s++) {
      for (let e = 0; e < ring.length; e++) {
        const x = segmentCross(road[s], road[s + 1], ring[e], ring[(e + 1) % ring.length]);
        if (!x) continue;
        if (gates.some((g) => dist(g, x) < minSpacing)) continue;
        gates.push(x);
      }
    }
  }
  return gates;
}

/* --------------------------------------------------------------------- graph */

interface GraphEdge {
  a: number;
  b: number;
  length: number;
  /** Ward indices that border this edge (1 for a boundary edge, 2 inside). */
  wards: number[];
  /** How many routed gate paths run over it — the traffic count that sets tier. */
  use: number;
  geom: [Pt, Pt];
}

interface Graph {
  nodes: Pt[];
  edges: GraphEdge[];
  /** node index → indices into `edges`. */
  adj: number[][];
}

/**
 * Weld the ward polygons into one planar graph. Ward edges are shared exactly
 * (the tessellation emits identical endpoints), but coordinates are quantized to
 * a span-relative tolerance anyway so a float wobble cannot split a junction
 * into two nodes and cut the network in half.
 */
function buildGraph(wardPolys: readonly Pt[][], quant: number): Graph {
  const nodes: Pt[] = [];
  const nodeIndex = new Map<string, number>();
  const key = (p: Pt): string => `${Math.round(p[0] / quant)},${Math.round(p[1] / quant)}`;
  const nodeOf = (p: Pt): number => {
    const k = key(p);
    const hit = nodeIndex.get(k);
    if (hit !== undefined) return hit;
    const i = nodes.length;
    nodes.push([p[0], p[1]]);
    nodeIndex.set(k, i);
    return i;
  };

  const edges: GraphEdge[] = [];
  const edgeIndex = new Map<string, number>();
  for (let w = 0; w < wardPolys.length; w++) {
    const poly = wardPolys[w];
    for (let i = 0; i < poly.length; i++) {
      const a = nodeOf(poly[i]);
      const b = nodeOf(poly[(i + 1) % poly.length]);
      if (a === b) continue; // zero-length ward edge; nothing to pave
      const ek = a < b ? `${a}|${b}` : `${b}|${a}`;
      const hit = edgeIndex.get(ek);
      if (hit !== undefined) {
        if (!edges[hit].wards.includes(w)) edges[hit].wards.push(w);
        continue;
      }
      edgeIndex.set(ek, edges.length);
      edges.push({
        a, b,
        length: dist(nodes[a], nodes[b]),
        wards: [w],
        use: 0,
        geom: [[poly[i][0], poly[i][1]], [poly[(i + 1) % poly.length][0], poly[(i + 1) % poly.length][1]]],
      });
    }
  }

  const adj: number[][] = nodes.map(() => []);
  edges.forEach((e, i) => { adj[e.a].push(i); adj[e.b].push(i); });
  return { nodes, edges, adj };
}

/** Graph node nearest to a point (linear scan — towns have hundreds of nodes). */
function nearestNode(g: Graph, p: Pt): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < g.nodes.length; i++) {
    const d = dist(g.nodes[i], p);
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/**
 * Dijkstra from `from` to `to`, returning the edge indices of the path (empty
 * when unreachable). A plain binary-heap-free scan is fine at town size and
 * keeps the module dependency-free and deterministic.
 */
function shortestPath(
  g: Graph,
  from: number,
  to: number,
  weightOf: (edge: GraphEdge) => number,
): number[] {
  const n = g.nodes.length;
  const distTo = new Float64Array(n).fill(Infinity);
  const viaEdge = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  distTo[from] = 0;
  for (;;) {
    let u = -1;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) if (!done[i] && distTo[i] < bestD) { bestD = distTo[i]; u = i; }
    if (u < 0 || u === to) break;
    done[u] = 1;
    for (const ei of g.adj[u]) {
      const e = g.edges[ei];
      const v = e.a === u ? e.b : e.a;
      if (done[v]) continue;
      const nd = distTo[u] + weightOf(e);
      if (nd < distTo[v]) { distTo[v] = nd; viaEdge[v] = ei; }
    }
  }
  if (!isFinite(distTo[to])) return [];
  const path: number[] = [];
  let cur = to;
  while (cur !== from) {
    const ei = viaEdge[cur];
    if (ei < 0) return [];
    path.push(ei);
    const e = g.edges[ei];
    cur = e.a === cur ? e.b : e.a;
  }
  return path.reverse();
}

/**
 * Chain a path's edges into ONE polyline. Routed spines are drawn as a single
 * continuous street rather than a pile of segments, so a renderer's ribbon
 * mitres its corners instead of leaving a notch at every junction.
 */
function pathToPolyline(g: Graph, path: readonly number[]): Pt[] {
  if (path.length === 0) return [];
  const first = g.edges[path[0]];
  // Orient the first edge away from the second so the chain runs one way.
  let cur: number;
  if (path.length === 1) {
    cur = first.a;
  } else {
    const second = g.edges[path[1]];
    cur = (first.a === second.a || first.a === second.b) ? first.b : first.a;
  }
  const line: Pt[] = [[g.nodes[cur][0], g.nodes[cur][1]]];
  for (const ei of path) {
    const e = g.edges[ei];
    const next = e.a === cur ? e.b : e.a;
    line.push([g.nodes[next][0], g.nodes[next][1]]);
    cur = next;
  }
  return line;
}

/* ------------------------------------------------------------------- network */

/**
 * Trim an approach road down to the parts OUTSIDE the wall ring, cut at the ring
 * crossings — its gates. Inside the wall the routed spine takes over, so the
 * road no longer ploughs across the wards and the market square.
 *
 * Works by splitting every segment at ALL of its ring crossings first, then
 * classifying each piece by its own midpoint. The obvious version — test the two
 * endpoints and take the first crossing found — silently loses the far half of a
 * road that drives clean through the town in ONE straight segment, because such
 * a segment has both endpoints outside and TWO crossings.
 *
 * A road that never reaches the ring (an unwalled settlement, or a road that
 * only skirts the town) comes back whole.
 */
function trimApproach(road: readonly Pt[], ring: readonly Pt[]): Pt[][] {
  if (ring.length < 3) return [road.map((p) => [p[0], p[1]] as Pt)];

  const out: Pt[][] = [];
  let run: Pt[] = [];
  const flush = (): void => { if (run.length >= 2) out.push(run); run = []; };

  for (let i = 0; i < road.length - 1; i++) {
    const a = road[i];
    const b = road[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy;

    // Every crossing of this segment, ordered along it.
    const cuts: Array<{ t: number; p: Pt }> = [];
    for (let e = 0; e < ring.length; e++) {
      const x = segmentCross(a, b, ring[e], ring[(e + 1) % ring.length]);
      if (!x) continue;
      const t = L2 > 1e-12 ? ((x[0] - a[0]) * dx + (x[1] - a[1]) * dy) / L2 : 0;
      if (cuts.some((c) => Math.abs(c.t - t) < 1e-9)) continue; // a corner hit twice
      cuts.push({ t, p: x });
    }
    cuts.sort((p, q) => p.t - q.t);

    // Walk the segment piece by piece; a piece is kept when its MIDPOINT is
    // outside the ring, which is unambiguous however the endpoints sit.
    const stops: Pt[] = [a, ...cuts.map((c) => c.p), b];
    for (let k = 0; k < stops.length - 1; k++) {
      const p0 = stops[k];
      const p1 = stops[k + 1];
      if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 1e-9) continue;
      const mid: Pt = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      if (pointInPoly(mid, ring)) { flush(); continue; }
      if (run.length === 0) run.push([p0[0], p0[1]]);
      run.push([p1[0], p1[1]]);
    }
  }
  flush();
  return out;
}

/**
 * Build the town's street network.
 *
 * Deterministic: no randomness at all. Same wards + same gates ⇒ same streets,
 * which is what lets the 2D map, the 3D minimap and the streamed game ground
 * agree on one town.
 */
export function buildStreetNetwork(input: StreetNetworkInput): TownStreet[] {
  const { wardPolys, wardCivic, wallRing, gatehouses, approachRoads, envelope, laneWidth } = input;
  if (wardPolys.length === 0) return [];

  const span = polygonSpan(envelope.length >= 3 ? envelope : wardPolys.flat());
  const graph = buildGraph(wardPolys, Math.max(span * 1e-4, 1e-6));
  if (graph.edges.length === 0) return [];

  // ---- Route the through-traffic. -----------------------------------------
  // The heart is the market square when the town has one (that is where the
  // roads are going), otherwise the geometric center of the build envelope.
  const plazaWard = wardCivic.findIndex((c) => c === 'plaza');
  const heartPoint = plazaWard >= 0
    ? polygonCentroidLocal(wardPolys[plazaWard])
    : polygonCentroidLocal(envelope.length >= 3 ? envelope : wardPolys[0]);
  const heartNode = nearestNode(graph, heartPoint);

  // Where traffic ENTERS. A walled town's entries are its gatehouses (already
  // seated on the roads by `buildWalls`). An unwalled village has no gates, so
  // the same rule is applied to the boundary it does have: the point where each
  // approach road crosses the build envelope. Without this a village routed no
  // spine at all and every one of its lanes stayed the same width.
  const entries: Pt[] = gatehouses.length > 0
    ? gatehouses.map((g) => [g[0], g[1]] as Pt)
    : roadGateCandidates(envelope, approachRoads, span * 0.08);
  // Keep each entry POINT beside the graph node it snapped to. Two entries can
  // snap to one node (a corner between two close gates); the pair is deduped by
  // node so a route is not traced twice, and the surviving point is the one the
  // spine is later extended to.
  const gateNodes: number[] = [];
  const gatePoints: Pt[] = [];
  for (const g of entries) {
    const n = nearestNode(graph, g);
    if (n < 0 || gateNodes.includes(n)) continue;
    gateNodes.push(n);
    gatePoints.push([g[0], g[1]]);
  }

  // Gate → heart is what makes a HIGH STREET; gate → gate is what makes a town
  // you can pass through. Both are counted, so an edge shared by several routes
  // outranks one that carries a single errand.
  // Route WEIGHT, not raw length. A pure shortest path let a high street peel
  // off and follow the inside face of the wall for half its run — geometrically
  // shortest, but it reads as a town whose main road avoids its own middle.
  // Edges hugging the rampart therefore cost more, so a route takes them only
  // when nothing through the town is close in length.
  const ringBand = span * 0.14;
  const weightOf = (e: GraphEdge): number => {
    if (wallRing.length < 3) return e.length;
    const mid: Pt = [(e.geom[0][0] + e.geom[1][0]) / 2, (e.geom[0][1] + e.geom[1][1]) / 2];
    const d = distToRing(mid, wallRing);
    return d >= ringBand ? e.length : e.length * (1 + RING_ROUTE_PENALTY * (1 - d / ringBand));
  };

  // Each spine carries the gate point it starts from, so extending it to the
  // arch later cannot pick up a different gate's coordinates.
  const spinePaths: Array<{ path: number[]; gate: Pt }> = [];
  gateNodes.forEach((gn, i) => {
    const p = shortestPath(graph, gn, heartNode, weightOf);
    if (p.length > 0) spinePaths.push({ path: p, gate: gatePoints[i] });
  });
  const throughPaths: number[][] = [];
  for (let i = 0; i < gateNodes.length; i++) {
    for (let j = i + 1; j < gateNodes.length; j++) {
      const p = shortestPath(graph, gateNodes[i], gateNodes[j], weightOf);
      if (p.length > 0) throughPaths.push(p);
    }
  }
  for (const p of [...spinePaths.map((sp) => sp.path), ...throughPaths]) {
    for (const ei of p) graph.edges[ei].use++;
  }

  // ---- Tier every ward edge. ----------------------------------------------
  // Traffic first, civic role second. `use >= 2` means at least two independent
  // routes chose this edge — that is a main street by definition, not by decree.
  const onRing = (e: GraphEdge): boolean => {
    if (wallRing.length < 3) return false;
    const mid: Pt = [(e.geom[0][0] + e.geom[1][0]) / 2, (e.geom[0][1] + e.geom[1][1]) / 2];
    return distToRing(mid, wallRing) < laneWidth;
  };

  const tierOf = (e: GraphEdge): { tier: StreetTierName; role: StreetRole } => {
    // Market-square frontage is the paved civic heart whatever its traffic.
    if (plazaWard >= 0 && e.wards.includes(plazaWard)) return { tier: 'plaza', role: 'ward' };
    if (e.use >= 2) return { tier: 'avenue', role: 'spine' };
    if (e.use === 1) return { tier: 'street', role: 'through' };
    // The intervallum: the lane that runs the inside face of the wall. Real
    // walled towns keep it clear so the rampart can be reached under siege, and
    // it is what stops houses packing flush against the stone.
    if (onRing(e)) return { tier: 'street', role: 'ring' };
    // A civic ward (temple/keep/citadel/dock quarter) paves its frontage.
    if (e.wards.some((w) => wardCivic[w])) return { tier: 'street', role: 'ward' };
    return { tier: 'lane', role: 'ward' };
  };

  const edgeTier: StreetTierName[] = [];
  const edgeRole: StreetRole[] = [];
  graph.edges.forEach((e, i) => {
    const t = tierOf(e);
    edgeTier[i] = t.tier;
    edgeRole[i] = t.role;
  });

  // ---- Emit. ---------------------------------------------------------------
  // Routed spines come out as ONE polyline each so their ribbon mitres through
  // junctions. Their edges are then claimed so the per-edge pass does not paint
  // the same ground twice at a different width.
  const streets: TownStreet[] = [];
  const claimed = new Set<number>();

  // A wide tier must never be wider than the ground its wards can give up. The
  // cap lives HERE, not in the engine's block inset, because the width on the
  // street record is what every renderer paints: cap it downstream and the
  // painted ribbon grows wider than the gap the blocks were inset to leave, and
  // the avenue runs under the houses beside it. The narrower of the two
  // bordering wards governs.
  const wardSpans = wardPolys.map((poly) => polygonSpan(poly));
  const widthCapFor = (wards: readonly number[]): number => {
    let cap = Infinity;
    for (const w of wards) {
      // The market square builds nothing, so it can give up all the ground its
      // frontage needs. Capping against it inverted the hierarchy on towns with
      // a small plaza ward: the market frontage came out NARROWER than the
      // avenue feeding it.
      if (wardCivic[w] === 'plaza') continue;
      cap = Math.min(cap, wardSpans[w] * MAX_WARD_WIDTH_FRAC);
    }
    return isFinite(cap) ? cap : Infinity;
  };
  const widthFor = (tier: StreetTierName, cap: number): number =>
    Math.min(laneWidth * TIER_WIDTH_RATIO[tier], cap);

  spinePaths.forEach(({ path, gate }) => {
    // A spine is painted at the best tier any of its edges earned, so the high
    // street does not narrow and widen along its own length; its width is capped
    // by the tightest ward it squeezes past for the same reason.
    //
    // CEILING (measured 2026-08-24): the promotion is capped at `avenue`. The
    // plaza tier belongs to the market square's OWN frontage — it is the widest,
    // brightest paving a town has. Letting a spine inherit it from a single
    // touching edge painted that flagstone along the spine's ENTIRE length: on
    // Hafting, plaza-tier paving reached 153 m from a square of radius 27.8 m,
    // over 611 m of run, and the town read as one bright sheet with the ground
    // showing through as green shards between the ribbons.
    let tier: StreetTierName = 'lane';
    let cap = Infinity;
    for (const ei of path) {
      tier = bestTier(tier, edgeTier[ei]);
      cap = Math.min(cap, widthCapFor(graph.edges[ei].wards));
    }
    if (tier === 'plaza') tier = 'avenue';
    let line = pathToPolyline(graph, path);
    if (line.length < 2) return;
    // RUN THE HIGH STREET TO ITS GATE. The path can only reach the nearest ward
    // corner to the gatehouse, which leaves the avenue stopping a little short
    // of the wall — its rounded end then bulges past the narrower ring lane as a
    // lollipop, and the town reads as if the main road misses the gate. Adding
    // the gate point closes both: the street arrives AT the arch, and its cap
    // ends up under the gatehouse.
    if (dist(line[0], gate) <= dist(line[line.length - 1], gate)) line = [[gate[0], gate[1]], ...line];
    else line = [...line, [gate[0], gate[1]]];
    // A spine claims the edges it paints so the same ground is not painted twice
    // at two widths — EXCEPT the market square's own frontage. Those edges stay
    // unclaimed so the square keeps a COMPLETE plaza-tier ring: letting a spine
    // swallow most of the ring left one orphan plaza edge jutting out of the
    // square as a lone bright bar, with the rest of the ring painted avenue.
    // The ring is emitted below and, being the top tier, paints over the spine
    // that runs under it in both renderers.
    for (const ei of path) {
      if (plazaWard >= 0 && graph.edges[ei].wards.includes(plazaWard)) continue;
      claimed.add(ei);
    }
    streets.push({ centerline: line, tier, role: 'spine', width: widthFor(tier, cap) });
  });

  graph.edges.forEach((e, i) => {
    if (claimed.has(i)) return;
    streets.push({
      centerline: [e.geom[0], e.geom[1]],
      tier: edgeTier[i],
      role: edgeRole[i],
      width: widthFor(edgeTier[i], widthCapFor(e.wards)),
    });
  });

  // Approach roads: the extramural half only, ending at the gate they made.
  for (const road of approachRoads) {
    if (road.length < 2) continue;
    for (const piece of trimApproach(road, wallRing)) {
      if (piece.length < 2) continue;
      streets.push({
        centerline: piece,
        tier: 'avenue',
        role: 'approach',
        // Extramural: open country, no ward to squeeze it, so no cap.
        width: widthFor('avenue', Infinity),
      });
    }
  }

  return streets;
}

/**
 * Half-width per ward edge, keyed the way `townEngine` keys its ward polygon
 * edges — the bridge that makes the gap the generator leaves EQUAL the ribbon
 * the renderers paint. Any edge the network never tiered (an unwalled plan with
 * no wards, say) is absent, and the caller applies its lane default.
 */
export function halfWidthByWardEdge(
  streets: readonly TownStreet[],
  quant: number,
): Map<string, number> {
  const out = new Map<string, number>();
  const key = (a: Pt, b: Pt): string => {
    const ka = `${Math.round(a[0] / quant)},${Math.round(a[1] / quant)}`;
    const kb = `${Math.round(b[0] / quant)},${Math.round(b[1] / quant)}`;
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };
  for (const s of streets) {
    if (s.role === 'approach') continue; // extramural: no ward block borders it
    for (let i = 0; i < s.centerline.length - 1; i++) {
      const k = key(s.centerline[i], s.centerline[i + 1]);
      out.set(k, Math.max(out.get(k) ?? 0, s.width / 2));
    }
  }
  return out;
}

/** Ordered widest→narrowest, re-exported so consumers need one import. */
export { STREET_TIER_ORDER };
export type { StreetTierName };
