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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 29/10/2026, 01:49:01
 * Dependents: components/Worldforge/AgentSimPreview.tsx, components/Worldforge/TownAgentSnapshotView.tsx, systems/worldforge/bridge/groundAgentMotion.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/bridge/residentDoorRoutes.ts, systems/worldforge/roster/townSnapshot.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { TownPlan } from '../artifacts';

// ============================================================================
// Public geometry receipts
// ============================================================================
// These small records let renderers and tests inspect the same entrance and
// street facts used by routing instead of reconstructing approximate doors.
// ============================================================================

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
  /** The plot's plan role ('house', 'market', 'temple' …). Errand selection
   * (roster/errands.ts) reads it, so every layer that holds this graph picks
   * the same public destination without the plan. Absent on hand-built graphs. */
  role?: string;
}

export interface StreetGraph {
  /** Node positions, index = node id. */
  nodes: Point[];
  /** Undirected walkable links with their length in feet. */
  adj: Array<Array<{ to: number; w: number }>>;
  /** Individual spans preserve where an entrance joins between graph nodes. */
  segments: StreetSegment[];
  /** Street-facing entrance receipt for every plot that has usable geometry. */
  plotEntrances: Map<number, PlotEntrance>;
}

// ============================================================================
// Shared geometry helpers
// ============================================================================
// Town plans contain ordinary coordinate pairs. These helpers compare, measure,
// and project those pairs without depending on a renderer or physics engine.
// ============================================================================

/** One-foot buckets merge nearly coincident street vertices into intersections. */
const QUANT_FT = 1;

/** Existing callers pass exact generated centroids; this tolerance absorbs only floating-point noise. */
const ENDPOINT_EPSILON_FT = 1e-6;

/** Build a stable key for a street vertex's one-foot bucket. */
const keyOf = (point: Point): string => (
  `${Math.round(point[0] / QUANT_FT)},${Math.round(point[1] / QUANT_FT)}`
);

/** Straight-line distance between two town positions. */
const distanceBetween = (a: Point, b: Point): number => (
  Math.hypot(a[0] - b[0], a[1] - b[1])
);

/** Treat only visually identical positions as the same route point. */
function pointsMatch(a: Point, b: Point): boolean {
  return distanceBetween(a, b) <= ENDPOINT_EPSILON_FT;
}

/** Average a plot's corners to match the centroid convention used by current callers. */
function footprintCentroid(footprint: Point[]): Point {
  if (footprint.length === 0) return [0, 0];

  // Average every authored corner. This intentionally matches AgentSimPreview
  // and townSnapshot, so their existing centroid endpoints resolve to doors.
  let x = 0;
  let y = 0;
  for (const point of footprint) {
    x += point[0];
    y += point[1];
  }
  return [x / footprint.length, y / footprint.length];
}

interface SegmentProjection {
  point: Point;
  t: number;
  distanceFt: number;
}

/** Closest point on a finite street span, including either end. */
function projectOntoSegment(point: Point, start: Point, end: Point): SegmentProjection {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;

  // A collapsed authored span behaves like its surviving endpoint. Graph
  // construction normally removes these, but the guard keeps this helper total.
  if (lengthSquared === 0) {
    return { point: start, t: 0, distanceFt: distanceBetween(point, start) };
  }

  const unclamped = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared;
  const t = Math.max(0, Math.min(1, unclamped));
  const projected: Point = [start[0] + dx * t, start[1] + dy * t];
  return { point: projected, t, distanceFt: distanceBetween(point, projected) };
}

interface GraphProjection extends SegmentProjection {
  segmentIndex: number;
}

/** Find the closest walkable point across every street span. */
function nearestStreetProjection(graph: StreetGraph, point: Point): GraphProjection | undefined {
  let best: GraphProjection | undefined;

  // Segment order is stable. Equal-distance ties therefore keep the first span,
  // which makes entrance placement deterministic at symmetrical intersections.
  for (let segmentIndex = 0; segmentIndex < graph.segments.length; segmentIndex++) {
    const segment = graph.segments[segmentIndex];
    const projection = projectOntoSegment(
      point,
      graph.nodes[segment.fromNode],
      graph.nodes[segment.toNode],
    );
    if (!best || projection.distanceFt < best.distanceFt) {
      best = { ...projection, segmentIndex };
    }
  }
  return best;
}

// GG-601 (2026-11-02): the straight step from a door to its street point must
// not cut through a neighbor's building. About 1% of walked length did, when
// the nearest street point lay past a neighbor's corner. The door itself never
// moves (interiors are fitted to it); only the street point it joins may.
const CONNECTOR_DETOUR_FT = 40;
const CONNECTOR_CLEAR_FT = 1;
const CONNECTOR_SLIDES_FT = [-5, 5, -10, 10, -15, 15, -20, 20, -25, 25, -30, 30];
const PLOT_GRID_FT = 60;

type PlotIndex = Map<string, Array<{ id: number; footprint: Point[] }>>;

function plotIndexFor(plots: ReadonlyArray<{ id: number; footprint: Point[] }>): PlotIndex {
  const grid: PlotIndex = new Map();
  for (const plot of plots) {
    if (plot.footprint.length < 3) continue;
    const xs = plot.footprint.map((q) => q[0]), ys = plot.footprint.map((q) => q[1]);
    for (let gx = Math.floor(Math.min(...xs) / PLOT_GRID_FT); gx <= Math.floor(Math.max(...xs) / PLOT_GRID_FT); gx++) {
      for (let gy = Math.floor(Math.min(...ys) / PLOT_GRID_FT); gy <= Math.floor(Math.max(...ys) / PLOT_GRID_FT); gy++) {
        const key = `${gx},${gy}`;
        const cell = grid.get(key);
        if (cell) cell.push(plot); else grid.set(key, [plot]);
      }
    }
  }
  return grid;
}

function insidePolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > point[1]) !== (yj > point[1]) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Length (ft, sampled every 2 ft) of the step a -> b inside a plot. A step
 * back into its own building counts too, except its first few feet: a fitted
 * door leaf stands on the wall, which is inset from the plot edge. */
const OWN_SETBACK_FT = 6;
function crossingFt(a: Point, b: Point, ownId: number, index: PlotIndex): number {
  const length = distanceBetween(a, b);
  const steps = Math.max(1, Math.ceil(length / 2));
  let inside = 0;
  for (let k = 0; k < steps; k++) {
    const t = (k + 0.5) / steps;
    const p: Point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const cell = index.get(`${Math.floor(p[0] / PLOT_GRID_FT)},${Math.floor(p[1] / PLOT_GRID_FT)}`);
    const nearDoor = length * t <= OWN_SETBACK_FT;
    if (cell?.some((plot) => (plot.id !== ownId || !nearDoor) && insidePolygon(p, plot.footprint))) inside += length / steps;
  }
  return inside;
}

/** The street point a door joins: the nearest one whose step stays clear of
 * other plots, within a short detour; else the one that crosses least. When
 * the nearest point is clear (most doors) the result is the old nearest one. */
function clearStreetProjection(graph: StreetGraph, door: Point, ownId: number, index: PlotIndex): GraphProjection | undefined {
  const nearest = nearestStreetProjection(graph, door);
  if (!nearest || crossingFt(door, nearest.point, ownId, index) <= CONNECTOR_CLEAR_FT) return nearest;
  const candidates: GraphProjection[] = [];
  for (let segmentIndex = 0; segmentIndex < graph.segments.length; segmentIndex++) {
    const segment = graph.segments[segmentIndex];
    const projection = projectOntoSegment(door, graph.nodes[segment.fromNode], graph.nodes[segment.toNode]);
    if (projection.distanceFt <= nearest.distanceFt + CONNECTOR_DETOUR_FT) candidates.push({ ...projection, segmentIndex });
  }
  // Points that slide along the nearest span: a slant step can pass beside a
  // neighbor's corner that the square step would cut.
  const near = graph.segments[nearest.segmentIndex];
  const [ax, ay] = graph.nodes[near.fromNode], [bx, by] = graph.nodes[near.toNode];
  const spanFt = distanceBetween(graph.nodes[near.fromNode], graph.nodes[near.toNode]);
  for (const slideFt of CONNECTOR_SLIDES_FT) {
    if (spanFt === 0) break;
    const t = Math.max(0, Math.min(1, nearest.t + slideFt / spanFt));
    const point: Point = [ax + (bx - ax) * t, ay + (by - ay) * t];
    const distanceFt = distanceBetween(door, point);
    if (distanceFt <= nearest.distanceFt + CONNECTOR_DETOUR_FT) candidates.push({ point, t, distanceFt, segmentIndex: nearest.segmentIndex });
  }
  candidates.sort((x, y) => x.distanceFt - y.distanceFt || x.segmentIndex - y.segmentIndex);
  let best = nearest, bestCross = Infinity;
  for (const candidate of candidates) {
    const cross = crossingFt(door, candidate.point, ownId, index);
    if (cross <= CONNECTOR_CLEAR_FT) return candidate;
    if (cross < bestCross - 1e-9) { best = candidate; bestCross = cross; }
  }
  return best;
}

/** A dead end this close to another span joins it (ft). */
const T_JOIN_FT = 2;

/** A plan-only door takes the house front edge when that edge is no more
 * than this much farther from a street than the nearest wall (ft): one
 * door step (GG-554, GG-608). */
const FRONT_DOOR_SLACK_FT = 5;

/**
 * Split a span at each dead end that lies on it, so a T-junction is walkable.
 * Mutates the graph arrays in place. Deterministic: dead ends go in node
 * order, splits on one span in order along it, and ties keep the first span.
 */
function joinStreetEnds(
  nodes: Point[],
  adj: StreetGraph['adj'],
  segments: StreetSegment[],
  linkedSegments: Set<string>,
): void {
  const splits = new Map<number, Array<{ t: number; node: number }>>();
  const extraLinks: Array<[number, number]> = [];
  for (let node = 0; node < nodes.length; node++) {
    if (adj[node].length !== 1) continue;
    let best: { segmentIndex: number; t: number; distanceFt: number } | undefined;
    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
      const segment = segments[segmentIndex];
      if (segment.fromNode === node || segment.toNode === node) continue;
      const projection = projectOntoSegment(nodes[node], nodes[segment.fromNode], nodes[segment.toNode]);
      if (projection.distanceFt <= T_JOIN_FT && (!best || projection.distanceFt < best.distanceFt)) {
        best = { segmentIndex, t: projection.t, distanceFt: projection.distanceFt };
      }
    }
    if (!best) continue;
    const segment = segments[best.segmentIndex];
    // Near a span's end: join that end node; else split the span.
    const lengthFt = distanceBetween(nodes[segment.fromNode], nodes[segment.toNode]);
    if (best.t * lengthFt <= T_JOIN_FT) extraLinks.push([node, segment.fromNode]);
    else if ((1 - best.t) * lengthFt <= T_JOIN_FT) extraLinks.push([node, segment.toNode]);
    else {
      const list = splits.get(best.segmentIndex) ?? [];
      list.push({ t: best.t, node });
      splits.set(best.segmentIndex, list);
    }
  }
  const addLink = (fromNode: number, toNode: number): void => {
    if (fromNode === toNode) return;
    const key = `${Math.min(fromNode, toNode)}:${Math.max(fromNode, toNode)}`;
    if (linkedSegments.has(key)) return;
    const lengthFt = distanceBetween(nodes[fromNode], nodes[toNode]);
    adj[fromNode].push({ to: toNode, w: lengthFt });
    adj[toNode].push({ to: fromNode, w: lengthFt });
    segments.push({ fromNode, toNode });
    linkedSegments.add(key);
  };
  const removed = new Set<number>();
  for (const segmentIndex of [...splits.keys()].sort((x, y) => x - y)) {
    const { fromNode, toNode } = segments[segmentIndex];
    removed.add(segmentIndex);
    linkedSegments.delete(`${Math.min(fromNode, toNode)}:${Math.max(fromNode, toNode)}`);
    adj[fromNode] = adj[fromNode].filter((edge) => edge.to !== toNode);
    adj[toNode] = adj[toNode].filter((edge) => edge.to !== fromNode);
    // Walk the span from its start: start -> split -> ... -> end. Each split
    // point is the dead end's own projection; a tiny link reaches the dead end.
    let previous = fromNode;
    for (const split of splits.get(segmentIndex)!.sort((x, y) => x.t - y.t || x.node - y.node)) {
      const [ax, ay] = nodes[fromNode], [bx, by] = nodes[toNode];
      const at = nodes.length;
      nodes.push([ax + (bx - ax) * split.t, ay + (by - ay) * split.t]);
      adj.push([]);
      addLink(previous, at);
      addLink(at, split.node);
      previous = at;
    }
    addLink(previous, toNode);
  }
  for (const [fromNode, toNode] of extraLinks) addLink(fromNode, toNode);
  if (removed.size === 0) return;
  // Drop the split spans; later spans keep their relative order.
  const kept = segments.filter((_, index) => !removed.has(index));
  segments.length = 0;
  segments.push(...kept);
}

/** Add a route point unless it repeats the previous position. */
function appendDistinct(path: Point[], point: Point): void {
  if (path.length === 0 || !pointsMatch(path[path.length - 1], point)) path.push(point);
}

/** Remove zero-length steps while preserving the route's authored order. */
function compactPath(points: Point[]): Point[] {
  const compacted: Point[] = [];
  for (const point of points) appendDistinct(compacted, point);
  return compacted;
}

// ============================================================================
// Street graph and front-door placement
// ============================================================================
// Street centreline vertices form the reusable network. Plot entrances are then
// derived against the completed network so every door uses the same street facts.
// ============================================================================

/** Build the existing street network. Ground callers may supply fitted door
 * centers; ordinary plan/preview callers retain their wall-midpoint entrances. */
export function buildStreetGraph(
  plan: TownPlan,
  physicalDoors?: ReadonlyMap<number, Point>,
): StreetGraph {
  const nodes: Point[] = [];
  const adj: StreetGraph['adj'] = [];
  const segments: StreetSegment[] = [];
  const index = new Map<string, number>();
  const linkedSegments = new Set<string>();

  /** Reuse a nearby authored vertex or create one stable graph node. */
  const nodeFor = (point: Point): number => {
    const key = keyOf(point);
    let node = index.get(key);
    if (node === undefined) {
      node = nodes.length;
      nodes.push(point);
      adj.push([]);
      index.set(key, node);
    }
    return node;
  };

  /** Join two nodes once, in both walking directions. */
  const link = (fromNode: number, toNode: number): void => {
    if (fromNode === toNode) return;

    const low = Math.min(fromNode, toNode);
    const high = Math.max(fromNode, toNode);
    const segmentKey = `${low}:${high}`;
    if (linkedSegments.has(segmentKey)) return;

    const lengthFt = distanceBetween(nodes[fromNode], nodes[toNode]);
    adj[fromNode].push({ to: toNode, w: lengthFt });
    adj[toNode].push({ to: fromNode, w: lengthFt });
    segments.push({ fromNode, toNode });
    linkedSegments.add(segmentKey);
  };

  // Street ids are stable. Sorting them makes graph construction independent
  // of input array order while preserving point order along each centreline.
  const streets = [...plan.streets].sort((left, right) => left.id - right.id);
  for (const street of streets) {
    for (let pointIndex = 1; pointIndex < street.centerline.length; pointIndex++) {
      const fromNode = nodeFor(street.centerline[pointIndex - 1]);
      const toNode = nodeFor(street.centerline[pointIndex]);
      link(fromNode, toNode);
    }
  }

  // GG-601 (2026-11-02): a street that ends on the middle of another street's
  // span (a T-junction) shared no node with it, so the two were not joined.
  // The seed-42 town had 13 such stubs; every leg to a door on one of them
  // fell back to a straight line through the buildings (838 of 3,886 legs).
  // Join each dead end that lies on another span: split that span there.
  joinStreetEnds(nodes, adj, segments, linkedSegments);

  const graph: StreetGraph = { nodes, adj, segments, plotEntrances: new Map() };

  // The closest wall midpoint is the building's street-facing facade. Choosing
  // a midpoint keeps doors away from corners and works for rotated/L-shaped lots.
  const plots = [...plan.plots].sort((left, right) => left.id - right.id);
  const plotIndex = plotIndexFor(plots);
  for (const plot of plots) {
    if (plot.footprint.length < 2 || segments.length === 0) continue;

    let bestDoor: Point | undefined;
    let bestStreet: GraphProjection | undefined;
    const fitted = physicalDoors?.get(plot.id);
    if (fitted && fitted.every(Number.isFinite)) {
      bestDoor = [...fitted];
      bestStreet = nearestStreetProjection(graph, bestDoor);
    }
    // A missing/invalid fitted door is unknown, not permission to invent one.
    // Keep the established plan-only behavior for those legacy plots.
    for (let cornerIndex = 0; !fitted?.every(Number.isFinite) && cornerIndex < plot.footprint.length; cornerIndex++) {
      const start = plot.footprint[cornerIndex];
      const end = plot.footprint[(cornerIndex + 1) % plot.footprint.length];
      const door: Point = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
      const street = nearestStreetProjection(graph, door);
      if (street && (!bestStreet || street.distanceFt < bestStreet.distanceFt)) {
        bestDoor = door;
        bestStreet = street;
      }
    }
    // GG-554 / GG-608 (2026-11-03): a house front is its first edge, and its
    // blueprint door is on that edge. When a deeper lot puts the back wall
    // a little nearer another street (demo plot 398: 15.7 against 15.8 ft),
    // the nearest midpoint alone chose the back wall. The front midpoint now
    // wins when it is within one door step of the nearest. A building whose
    // front faces away (a keep's long side) keeps its nearest wall.
    if (!fitted?.every(Number.isFinite) && plot.footprint.length >= 2 && bestStreet) {
      const [start, end] = plot.footprint;
      const front: Point = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
      const street = nearestStreetProjection(graph, front);
      if (street && street.distanceFt <= bestStreet.distanceFt + FRONT_DOOR_SLACK_FT) {
        bestDoor = front;
        bestStreet = street;
      }
    }

    // A valid street graph always yields a projection. Keep the defensive guard
    // so malformed legacy plots never poison routing for the rest of the town.
    if (!bestDoor || !bestStreet) continue;
    // The door stays; its street point moves only if the nearest one would
    // send walkers through a neighbor (GG-601).
    bestStreet = clearStreetProjection(graph, bestDoor, plot.id, plotIndex) ?? bestStreet;
    graph.plotEntrances.set(plot.id, {
      plotId: plot.id,
      centroid: footprintCentroid(plot.footprint),
      door: bestDoor,
      streetPoint: bestStreet.point,
      streetSegmentIndex: bestStreet.segmentIndex,
      connectorLengthFt: bestStreet.distanceFt,
      role: plot.role,
    });
  }

  return graph;
}

/** Read the canonical street-facing door for a plot, if its plan had streets. */
export function frontDoorForPlot(graph: StreetGraph, plotId: number): Point | undefined {
  return graph.plotEntrances.get(plotId)?.door;
}

// ============================================================================
// Deterministic shortest-path search
// ============================================================================
// Entrances may join in the middle of a long street span. The route search tries
// both ends of those spans, plus the direct same-span walk, then keeps the shortest.
// ============================================================================

/** Nearest graph vertex to a point. Retained for diagnostics and legacy callers. */
export function nearestNode(graph: StreetGraph, point: Point): number {
  let bestNode = -1;
  let bestDistance = Infinity;
  for (let node = 0; node < graph.nodes.length; node++) {
    const candidateDistance = distanceBetween(graph.nodes[node], point);
    if (candidateDistance < bestDistance) {
      bestDistance = candidateDistance;
      bestNode = node;
    }
  }
  return bestNode;
}

// GG-605 (2026-11-02): the search used to pick its next node by a scan of
// every node, and each route ran it four times. A capital of 1,733 buildings
// spent 97 s of a 120 s bake in it. Now a binary heap picks the next node, and
// one search per start node is kept and resumed for later goals.
//
// What is preserved: every route. The old scan took the unfinished node with
// the least distance and, on equal distance, the lowest node id; the heap
// orders by (distance, node id), so the nodes finish in the same order. A node's
// predecessor is fixed once it finishes, so a search resumed for a second goal
// gives the same path as a fresh search that stops at that goal.

interface NodeSearch {
  distanceTo: Float64Array;
  previous: Int32Array;
  finished: Uint8Array;
  /** Pending (distance, node) entries; stale ones are skipped when popped. */
  heapDistance: number[];
  heapNode: number[];
}

/** (distance, node id) order: the old scan's choice, including its tie rule. */
function heapBefore(search: NodeSearch, a: number, b: number): boolean {
  const da = search.heapDistance[a], db = search.heapDistance[b];
  return da < db || (da === db && search.heapNode[a] < search.heapNode[b]);
}

function heapSwap(search: NodeSearch, a: number, b: number): void {
  const d = search.heapDistance[a]; search.heapDistance[a] = search.heapDistance[b]; search.heapDistance[b] = d;
  const n = search.heapNode[a]; search.heapNode[a] = search.heapNode[b]; search.heapNode[b] = n;
}

function heapPush(search: NodeSearch, distance: number, node: number): void {
  search.heapDistance.push(distance);
  search.heapNode.push(node);
  for (let i = search.heapNode.length - 1; i > 0;) {
    const up = (i - 1) >> 1;
    if (!heapBefore(search, i, up)) break;
    heapSwap(search, i, up);
    i = up;
  }
}

/** Remove the first entry; the caller reads it from slot 0 before the call. */
function heapPop(search: NodeSearch): void {
  const last = search.heapNode.length - 1;
  heapSwap(search, 0, last);
  search.heapDistance.pop();
  search.heapNode.pop();
  for (let i = 0; ;) {
    const left = 2 * i + 1, right = left + 1;
    let best = i;
    if (left < last && heapBefore(search, left, best)) best = left;
    if (right < last && heapBefore(search, right, best)) best = right;
    if (best === i) break;
    heapSwap(search, i, best);
    i = best;
  }
}

/** Searches kept per graph, most recently used last. A bake asks for routes
 * from a few hundred start nodes; the cap bounds memory in a large capital. */
const SEARCHES_PER_GRAPH = 512;
const searchesByGraph = new WeakMap<StreetGraph, Map<number, NodeSearch>>();

function searchFrom(graph: StreetGraph, start: number): NodeSearch {
  let searches = searchesByGraph.get(graph);
  if (!searches) { searches = new Map(); searchesByGraph.set(graph, searches); }
  let search = searches.get(start);
  if (search) {
    searches.delete(start);
  } else {
    const nodeCount = graph.nodes.length;
    search = {
      distanceTo: new Float64Array(nodeCount).fill(Infinity),
      previous: new Int32Array(nodeCount).fill(-1),
      finished: new Uint8Array(nodeCount),
      heapDistance: [],
      heapNode: [],
    };
    search.distanceTo[start] = 0;
    heapPush(search, 0, start);
    if (searches.size >= SEARCHES_PER_GRAPH) searches.delete(searches.keys().next().value!);
  }
  searches.set(start, search);
  return search;
}

/** Find a stable shortest sequence of graph nodes; return no sequence when disconnected. */
function dijkstra(graph: StreetGraph, start: number, goal: number): number[] {
  const search = searchFrom(graph, start);
  const { distanceTo, previous, finished } = search;

  // Resume until the goal finishes or nothing is left to reach.
  while (!finished[goal] && search.heapNode.length > 0) {
    const current = search.heapNode[0], distance = search.heapDistance[0];
    heapPop(search);
    if (finished[current] || distance !== distanceTo[current]) continue; // stale entry
    finished[current] = 1;
    for (const edge of graph.adj[current]) {
      const candidateDistance = distanceTo[current] + edge.w;
      if (candidateDistance < distanceTo[edge.to]) {
        distanceTo[edge.to] = candidateDistance;
        previous[edge.to] = current;
        heapPush(search, candidateDistance, edge.to);
      }
    }
  }

  if (distanceTo[goal] === Infinity && start !== goal) return [];

  // Walk backward from the destination, then reverse into travel order.
  const path: number[] = [];
  for (let node = goal; node !== -1; node = previous[node]) {
    path.push(node);
    if (node === start) break;
  }
  return path.reverse();
}

interface RouteConnection {
  endpoint: Point;
  streetPoint: Point;
  streetSegmentIndex: number;
}

/** GG-605: entrances by 1 ft cell of their centroid and door, in entrance
 * order, so a route endpoint no longer scans every entrance. */
type EntranceIndex = Map<string, Array<{ order: number; entrance: PlotEntrance }>>;
const entranceIndexByGraph = new WeakMap<StreetGraph, { size: number; cells: EntranceIndex }>();
const cellKey = (x: number, y: number) => `${x},${y}`;
function entranceMatching(graph: StreetGraph, point: Point): PlotEntrance | undefined {
  let index = entranceIndexByGraph.get(graph);
  if (!index || index.size !== graph.plotEntrances.size) {
    const cells: EntranceIndex = new Map();
    let order = 0;
    for (const entrance of graph.plotEntrances.values()) {
      for (const [x, y] of [entrance.centroid, entrance.door]) {
        const key = cellKey(Math.floor(x), Math.floor(y));
        let list = cells.get(key);
        if (!list) { list = []; cells.set(key, list); }
        if (list.at(-1)?.order !== order) list.push({ order, entrance });
      }
      order++;
    }
    index = { size: graph.plotEntrances.size, cells };
    entranceIndexByGraph.set(graph, index);
  }
  // A match lies within 1e-6 ft, so it sits in this cell or a neighbor cell.
  let best: { order: number; entrance: PlotEntrance } | undefined;
  const cx = Math.floor(point[0]), cy = Math.floor(point[1]);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    for (const hit of index.cells.get(cellKey(cx + dx, cy + dy)) ?? []) {
      if (best && hit.order >= best.order) continue;
      if (pointsMatch(point, hit.entrance.centroid) || pointsMatch(point, hit.entrance.door)) best = hit;
    }
  }
  return best?.entrance;
}

/** Replace a known plot centroid with its actual door before joining the street. */
function connectionForPoint(graph: StreetGraph, point: Point): RouteConnection | undefined {
  // Existing motion callers pass plot centroids. A door is also accepted so a
  // route can be chained from a previously completed commute without drifting.
  // The first entrance in entrance order wins, as the old full scan did.
  const entrance = entranceMatching(graph, point);
  if (entrance) {
    return {
      endpoint: entrance.door,
      streetPoint: entrance.streetPoint,
      streetSegmentIndex: entrance.streetSegmentIndex,
    };
  }

  // Arbitrary callers still receive segment-accurate snapping. Their true point
  // remains the endpoint because no building entrance can be inferred safely.
  const projection = nearestStreetProjection(graph, point);
  if (!projection) return undefined;
  return {
    endpoint: point,
    streetPoint: projection.point,
    streetSegmentIndex: projection.segmentIndex,
  };
}

/** Candidate street-only paths between two mid-segment connections. */
function streetPathCandidates(
  graph: StreetGraph,
  from: RouteConnection,
  to: RouteConnection,
): Point[][] {
  const candidates: Point[][] = [];
  const fromSegment = graph.segments[from.streetSegmentIndex];
  const toSegment = graph.segments[to.streetSegmentIndex];

  // Two doors on the same street can walk directly along that span. The wider
  // network is still considered below in case a genuine loop is shorter.
  if (from.streetSegmentIndex === to.streetSegmentIndex) {
    candidates.push(compactPath([from.streetPoint, to.streetPoint]));
  }

  const fromEnds = [fromSegment.fromNode, fromSegment.toNode];
  const toEnds = [toSegment.fromNode, toSegment.toNode];
  for (const fromNode of fromEnds) {
    for (const toNode of toEnds) {
      const nodePath = dijkstra(graph, fromNode, toNode);
      if (nodePath.length === 0) continue;

      // The partial span from an entrance projection to its chosen endpoint is
      // included explicitly, so a door never snaps to a distant street corner.
      const points: Point[] = [from.streetPoint];
      for (const node of nodePath) points.push(graph.nodes[node]);
      points.push(to.streetPoint);
      candidates.push(compactPath(points));
    }
  }
  return candidates;
}

/**
 * Build a door-to-door walking polyline through the street network.
 *
 * Known plot centroids are replaced by their street-facing wall entrances.
 * Each entrance joins the nearest point on a street span, the shortest network
 * route connects those projections, and the final connector reaches the other
 * door. With no usable or connected streets, callers retain the safe straight
 * fallback between the positions they supplied.
 */
export function routeAlongStreets(graph: StreetGraph, from: Point, to: Point): Point[] {
  if (graph.segments.length === 0) return [from, to];

  const fromConnection = connectionForPoint(graph, from);
  const toConnection = connectionForPoint(graph, to);
  if (!fromConnection || !toConnection) return [from, to];

  // Staying at the same building should not send an agent out to the street and
  // back. Return the resolved door twice to preserve the two-endpoint contract.
  if (pointsMatch(fromConnection.endpoint, toConnection.endpoint)) {
    return [fromConnection.endpoint, toConnection.endpoint];
  }

  let bestPath: Point[] | undefined;
  let bestLength = Infinity;
  for (const streetPath of streetPathCandidates(graph, fromConnection, toConnection)) {
    const candidate = compactPath([
      fromConnection.endpoint,
      ...streetPath,
      toConnection.endpoint,
    ]);
    const candidateLength = pathLength(candidate);
    if (candidateLength < bestLength) {
      bestLength = candidateLength;
      bestPath = candidate;
    }
  }

  // Disconnected legacy networks keep movement finite and honest rather than
  // dropping an agent. The fallback remains the caller's original straight leg.
  return bestPath ?? [from, to];
}

// ============================================================================
// Route measurement and animation
// ============================================================================
// Callers animate by total distance rather than by point count, so short doorway
// connectors and long street spans move at one consistent walking speed.
// ============================================================================

/** Total length of a walking polyline, in feet. */
export function pathLength(path: Point[]): number {
  let length = 0;
  for (let pointIndex = 1; pointIndex < path.length; pointIndex++) {
    length += distanceBetween(path[pointIndex - 1], path[pointIndex]);
  }
  return length;
}

/**
 * Sample progress from 0 to 1 along a walking route by travelled distance.
 * Values below or above that range stay at the corresponding endpoint.
 */
export function positionAlongPath(path: Point[], progress: number): Point {
  if (path.length === 0) return [0, 0];
  if (path.length === 1 || progress <= 0) return path[0];

  const total = pathLength(path);
  if (progress >= 1 || total === 0) return path[path.length - 1];

  let remaining = progress * total;
  for (let pointIndex = 1; pointIndex < path.length; pointIndex++) {
    const start = path[pointIndex - 1];
    const end = path[pointIndex];
    const segmentLength = distanceBetween(start, end);
    if (remaining <= segmentLength) {
      const fraction = segmentLength === 0 ? 0 : remaining / segmentLength;
      return [
        start[0] + (end[0] - start[0]) * fraction,
        start[1] + (end[1] - start[1]) * fraction,
      ];
    }
    remaining -= segmentLength;
  }
  return path[path.length - 1];
}
