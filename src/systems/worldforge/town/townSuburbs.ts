/**
 * @file townSuburbs.ts — SUBURBS: houses strung along the roads outside a
 * town's gates (GG-544).
 *
 * WHY THIS EXISTS (town-look pass, 2026-10-31). Before this module no house
 * stood outside a town wall. The census of world 903674813 found 0 plots
 * outside the ring in all 706 walled towns and cities. In 4 measured Watabou
 * cities, 49% to 54% of the building area stands outside the wall, in ribbons
 * along the approach roads. Without them the wall reads as the edge of the
 * world and the road runs through empty fields to the gate.
 *
 * HOW MANY (Remy, town-look sheet q3: "Set by how full the walls are"). The
 * caller passes the target count. `townEngine` sets it from `wallFill`: a town
 * that needs every foot inside its walls spills as many houses outside as it
 * holds inside; a town that rattles around in its walls spills few. That ties
 * each suburb to a cause, so two towns differ for a reason.
 *
 * WHERE. Each extramural road piece is walked outward from its gate. Lots sit
 * on both sides, fronting the road edge, attached in rows near the gate and
 * thinning out with distance — the gap chance rises the farther the lot is
 * from the wall. A lot is refused when it touches the wall's standoff band,
 * leaves the town cell, touches a blocker (river, quay, dock, bridge), or
 * overlaps a lot already placed (two roads meet at a gate).
 *
 * IDENTITY. The engine appends suburb wards AFTER every intramural ward, so
 * the intramural plot numbers come first and keep their order.
 *
 * Pure: no React, no DOM, no import of `townEngine` at run time.
 */
import { rngFromPath, streamPath, type SeedPath } from '../seedPath';
import { pointInPolygon, type Pt } from '../submap/submapEngine';
import type { BuildingPlot } from './townEngine';

export interface SuburbRoad {
  /** The extramural road piece, in plan units. */
  line: readonly Pt[];
  /** Full paved width of the road. Lots front its edge. */
  width: number;
  /** Share of the suburb this road draws: an inherited road 1, a field track less. */
  weight: number;
}

export interface SuburbInput {
  roads: readonly SuburbRoad[];
  /** Wall ring. Lots keep `clearance` clear of it (the ditch and the glacis). */
  wallRing: readonly Pt[];
  /** The town cell. Lots stay inside it. */
  footprint: readonly Pt[];
  /** Total suburb lots to place across all roads. */
  target: number;
  lotWidth: number;
  minLotWidth: number;
  lotDepth: number;
  /** Cell grid the frontage snaps to (plan units); 0 = no snap. */
  snap: number;
  clearance: number;
  /** Polygons no lot may touch: river and quay corridors, docks, bridges. */
  blockers: readonly Pt[][];
  /** Overlap test shared with the engine (vertex containment or edge crossing). */
  intersects: (a: Pt[], b: Pt[]) => boolean;
  seedPath: SeedPath;
}

/** One side of one road: a row of lots and the ground strip under it. */
export interface SuburbRow {
  /** Ground strip from the road edge back to the lot depth (the buildable block). */
  strip: Pt[];
  /**
   * The same strip run out to the road CENTERLINE: the ward polygon. A ward's
   * edge is a street centerline everywhere else in the plan, so a suburb row
   * keeps that contract.
   */
  ground: Pt[];
  plots: BuildingPlot[];
}

export function polylineLength(line: readonly Pt[]): number {
  let L = 0;
  for (let i = 0; i < line.length - 1; i++) {
    L += Math.hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]);
  }
  return L;
}

/** Point and unit tangent at arc length `s` along a polyline. */
export function pointAt(line: readonly Pt[], s: number): { p: Pt; t: Pt } {
  let acc = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-12) continue;
    if (acc + L >= s || i === line.length - 2) {
      const f = Math.max(0, Math.min(1, (s - acc) / L));
      return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], t: [(b[0] - a[0]) / L, (b[1] - a[1]) / L] };
    }
    acc += L;
  }
  const last = line[line.length - 1];
  return { p: [last[0], last[1]], t: [1, 0] };
}

function distToRing(p: Pt, ring: readonly Pt[]): number {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2));
    best = Math.min(best, Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dy * t)));
  }
  return best;
}

/**
 * The polygon pulled 1% toward its centroid. The shared overlap test counts a
 * touching edge or corner as a hit, so two attached lots (or a house and the
 * garden behind it) would refuse each other. Testing the shrunken copy keeps
 * true overlaps and lets exact contact through.
 */
function shrunk(poly: readonly Pt[]): Pt[] {
  let x = 0, y = 0;
  for (const p of poly) { x += p[0]; y += p[1]; }
  x /= poly.length || 1; y /= poly.length || 1;
  return poly.map((p) => [x + (p[0] - x) * 0.99, y + (p[1] - y) * 0.99] as Pt);
}

/** Place the suburb rows (see the file header). Deterministic per `seedPath`. */
export function buildSuburbs(input: SuburbInput): SuburbRow[] {
  const { roads, wallRing, footprint, clearance, blockers, intersects } = input;
  const rows: SuburbRow[] = [];
  const target = Math.max(0, Math.round(input.target));
  if (target === 0 || roads.length === 0 || wallRing.length < 3) return rows;

  const totalWeight = roads.reduce((sum, r) => sum + Math.max(0, r.weight), 0);
  if (!(totalWeight > 0)) return rows;
  const placed: Pt[][] = [];
  const snapW = (w: number): number =>
    input.snap > 0
      ? Math.max(input.minLotWidth, Math.round(w / input.snap) * input.snap)
      : Math.max(input.minLotWidth, w);
  const fits = (raw: Pt[]): boolean => {
    const poly = shrunk(raw);
    for (const v of raw) {
      if (pointInPolygon(v, wallRing as Pt[])) return false;
      if (distToRing(v, wallRing) < clearance) return false;
      if (!pointInPolygon(v, footprint as Pt[])) return false;
    }
    for (const b of blockers) if (intersects(poly, b)) return false;
    for (const q of placed) if (intersects(poly, q)) return false;
    return true;
  };

  roads.forEach((road, roadIndex) => {
    if (road.line.length < 2 || !(road.weight > 0)) return;
    // Walk OUT from the gate: start at the end nearer the wall.
    const line = distToRing(road.line[0], wallRing) <= distToRing(road.line[road.line.length - 1], wallRing)
      ? road.line
      : [...road.line].reverse();
    const length = polylineLength(line);
    if (length < input.minLotWidth * 2) return;
    const quota = Math.round((target * road.weight) / totalWeight);
    if (quota === 0) return;
    const half = road.width / 2;

    for (const side of [1, -1] as const) {
      const rng = rngFromPath(streamPath(input.seedPath, `suburb:${roadIndex}:${side > 0 ? 'l' : 'r'}`));
      const sideQuota = side > 0 ? Math.ceil(quota / 2) : Math.floor(quota / 2);
      const plots: BuildingPlot[] = [];
      let s = clearance;
      let firstS = -1;
      let lastS = -1;
      let maxDepth = 0;
      // Lots stop half a lot short of the piece's end, so the ward strip can
      // always run past the last one (the street-margin rule).
      const endMargin = input.minLotWidth * 0.5;
      while (plots.length < sideQuota && s < length - input.minLotWidth - endMargin) {
        const w = Math.min(snapW(input.lotWidth * (0.75 + rng.next() * 0.75)), length - endMargin - s);
        const depth = input.lotDepth * (0.8 + rng.next() * 0.35);
        // The gap chance grows with distance from the gate: a row near the
        // wall is attached, the far end of the ribbon is scattered cottages.
        const gapChance = Math.min(0.65, 0.04 + 0.7 * (s / length));
        const a = pointAt(line, s);
        const b = pointAt(line, s + w);
        const tx = b.p[0] - a.p[0], ty = b.p[1] - a.p[1];
        const tl = Math.hypot(tx, ty) || 1;
        const nx = (-ty / tl) * side, ny = (tx / tl) * side;
        const p0: Pt = [a.p[0] + nx * half, a.p[1] + ny * half];
        const p1: Pt = [b.p[0] + nx * half, b.p[1] + ny * half];
        const polygon: Pt[] = [p0, p1, [p1[0] + nx * depth, p1[1] + ny * depth], [p0[0] + nx * depth, p0[1] + ny * depth]];
        if (fits(polygon)) {
          plots.push({ polygon, frontageEdge: 0, kind: 'frontage', shape: 'rect' });
          placed.push(polygon);
          if (firstS < 0) firstS = s;
          lastS = s + w;
          maxDepth = Math.max(maxDepth, depth);
        }
        s += w;
        if (rng.next() < gapChance) s += w * (0.6 + rng.next() * 1.4);
      }
      if (plots.length === 0) continue;
      rows.push({
        strip: stripAlong(line, firstS, lastS, half, half + maxDepth, side),
        // The ward runs a little past the row at both ends and behind it,
        // so no lot corner sits on the ward edge (the street-margin rule).
        ground: stripAlong(
          line,
          Math.max(0, firstS - input.minLotWidth * 0.5),
          Math.min(length, lastS + input.minLotWidth * 0.5),
          0,
          (half + maxDepth) * 1.5,
          side,
        ),
        plots,
      });
    }
  });
  return rows;
}

/** Ground band on one side of a polyline, between two offsets, over [s0, s1]. */
export function stripAlong(line: readonly Pt[], s0: number, s1: number, near: number, far: number, side: 1 | -1): Pt[] {
  // One sample per half strip-depth follows the road's bends closely enough.
  // The depth, not `near`, sets the spacing: a ward strip starts AT the road
  // centerline (near = 0), and dividing by that asked for billions of points.
  const steps = Math.max(2, Math.min(256, Math.ceil((s1 - s0) / Math.max((far - near) * 0.5, 1e-6))));
  const front: Pt[] = [];
  const back: Pt[] = [];
  for (let k = 0; k <= steps; k++) {
    const sv = s0 + ((s1 - s0) * k) / steps;
    const { p, t } = pointAt(line, sv);
    const nx = -t[1] * side, ny = t[0] * side;
    front.push([p[0] + nx * near, p[1] + ny * near]);
    back.push([p[0] + nx * far, p[1] + ny * far]);
  }
  return [...front, ...back.reverse()];
}
