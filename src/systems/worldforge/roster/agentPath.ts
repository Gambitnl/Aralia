// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 18/07/2026, 18:54:58
 * Dependents: components/Worldforge/AgentSimPreview.tsx, components/Worldforge/TownAgentSnapshotView.tsx, systems/worldforge/bridge/groundAgentMotion.ts, systems/worldforge/roster/townSnapshot.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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

/** Build an undirected street graph and one street-facing entrance per plot. */
export function buildStreetGraph(plan: TownPlan): StreetGraph {
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

  const graph: StreetGraph = { nodes, adj, segments, plotEntrances: new Map() };

  // The closest wall midpoint is the building's street-facing facade. Choosing
  // a midpoint keeps doors away from corners and works for rotated/L-shaped lots.
  const plots = [...plan.plots].sort((left, right) => left.id - right.id);
  for (const plot of plots) {
    if (plot.footprint.length < 2 || segments.length === 0) continue;

    let bestDoor: Point | undefined;
    let bestStreet: GraphProjection | undefined;
    for (let cornerIndex = 0; cornerIndex < plot.footprint.length; cornerIndex++) {
      const start = plot.footprint[cornerIndex];
      const end = plot.footprint[(cornerIndex + 1) % plot.footprint.length];
      const door: Point = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
      const street = nearestStreetProjection(graph, door);
      if (street && (!bestStreet || street.distanceFt < bestStreet.distanceFt)) {
        bestDoor = door;
        bestStreet = street;
      }
    }

    // A valid street graph always yields a projection. Keep the defensive guard
    // so malformed legacy plots never poison routing for the rest of the town.
    if (!bestDoor || !bestStreet) continue;
    graph.plotEntrances.set(plot.id, {
      plotId: plot.id,
      centroid: footprintCentroid(plot.footprint),
      door: bestDoor,
      streetPoint: bestStreet.point,
      streetSegmentIndex: bestStreet.segmentIndex,
      connectorLengthFt: bestStreet.distanceFt,
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

/** Find a stable shortest sequence of graph nodes; return no sequence when disconnected. */
function dijkstra(graph: StreetGraph, start: number, goal: number): number[] {
  const nodeCount = graph.nodes.length;
  const distanceTo = new Array<number>(nodeCount).fill(Infinity);
  const previous = new Array<number>(nodeCount).fill(-1);
  const finished = new Array<boolean>(nodeCount).fill(false);
  distanceTo[start] = 0;

  for (;;) {
    // Town graphs are small, so a linear nearest-node choice is simpler and
    // deterministic. Node-id order breaks equal-cost ties.
    let current = -1;
    let bestDistance = Infinity;
    for (let node = 0; node < nodeCount; node++) {
      if (!finished[node] && distanceTo[node] < bestDistance) {
        bestDistance = distanceTo[node];
        current = node;
      }
    }
    if (current === -1 || current === goal) break;

    finished[current] = true;
    for (const edge of graph.adj[current]) {
      const candidateDistance = distanceTo[current] + edge.w;
      if (candidateDistance < distanceTo[edge.to]) {
        distanceTo[edge.to] = candidateDistance;
        previous[edge.to] = current;
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

/** Replace a known plot centroid with its actual door before joining the street. */
function connectionForPoint(graph: StreetGraph, point: Point): RouteConnection | undefined {
  // Existing motion callers pass plot centroids. A door is also accepted so a
  // route can be chained from a previously completed commute without drifting.
  for (const entrance of graph.plotEntrances.values()) {
    if (pointsMatch(point, entrance.centroid) || pointsMatch(point, entrance.door)) {
      return {
        endpoint: entrance.door,
        streetPoint: entrance.streetPoint,
        streetSegmentIndex: entrance.streetSegmentIndex,
      };
    }
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
