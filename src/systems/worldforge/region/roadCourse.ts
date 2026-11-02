/**
 * @file roadCourse.ts — one world road's course in feet, smoothed but PINNED at
 * every town it serves.
 *
 * FMG routes join burgs: a route point in a burg's cell sits on the burg itself.
 * The region tier used to Chaikin-smooth the whole route, and Chaikin cuts every
 * corner, so a road that turned at a town missed it. Measured at Tineroe
 * (world 1793371993547, burg 738, GG-541): the Dunsfield-Kingdon trail passed
 * about 400 m from the town it was routed through.
 *
 * Here the route is split at every point whose cell holds a burg. Each piece is
 * smoothed on its own, and the burg points are kept exactly, so the road
 * bends smoothly between towns and runs through each town's center.
 *
 * The region tier (`generateRegion`) and the town generator (`townRoadCourse`)
 * both call this one function, so the wilderness road and the town's approach
 * road are the same line.
 */
import type { Feet } from '../units';
import { smoothRegionRiverCenterline } from './riverCenterlineSmoothing';

/** An FMG route point: [x px, y px, cell id] (FMG types it as number[]). */
export type RoutePoint = readonly number[];

/**
 * The route's course in world feet. `cellBurg[cell]` is the burg id in that
 * cell (0 = none). Points in a burg cell are kept exactly; the line between
 * two kept points is smoothed with the region curve profile.
 */
export function roadCourseFt(
  points: readonly RoutePoint[],
  feetPerPixel: number,
  cellBurg: ArrayLike<number>,
): Array<[Feet, Feet]> {
  const ft: Array<[Feet, Feet]> = points.map((p) => [p[0] * feetPerPixel, p[1] * feetPerPixel]);
  if (ft.length < 2) return ft;
  const pinned = points.map((p) => (cellBurg[p[2]] ?? 0) > 0);

  const out: Array<[Feet, Feet]> = [];
  let start = 0;
  for (let i = 1; i < ft.length; i++) {
    if (!pinned[i] && i < ft.length - 1) continue;
    const piece = ft.slice(start, i + 1);
    // Chaikin keeps neither end point, so a pinned end is put back by hand.
    // An unpinned route end keeps the old behavior: the smoothed line starts
    // a little in from it.
    const smooth = smoothRegionRiverCenterline(piece);
    if (pinned[start]) {
      if (out.length === 0) out.push(ft[start]);
    }
    out.push(...smooth);
    if (pinned[i]) out.push(ft[i]);
    start = i;
  }
  return out;
}

/**
 * Dry ground a road keeps between its center line and the water's edge, ft
 * (GG-582). It holds half of the widest road (a 44 ft highway) plus a bank.
 */
export const ROAD_RIVER_CLEAR_FT = 30;

/** One river a road must keep off: its center line and the distance to keep from it. */
export interface RoadRiverReach {
  line: ReadonlyArray<readonly [number, number]>;
  /** Least distance from the river's center line to the road's center line. */
  clear: number;
  /**
   * The same distance at each point of `line`, where the river widens along
   * its course (`riverRoadClearAtFt`). It wins over `clear` when present.
   */
  clearAt?: readonly number[];
}

/**
 * The clearance at each point of a river course, ft (GG-582): half the
 * river's width at the atlas segment nearest the point, plus
 * `ROAD_RIVER_CLEAR_FT`. A point takes its segment the way the region tier's
 * `generateRiverBanks` does, so the town and the region keep one clearance.
 * `segmentWidthFt[k]` is the width of the segment from `anchors[k]` to
 * `anchors[k + 1]`.
 */
export function riverRoadClearAtFt(
  course: ReadonlyArray<readonly [number, number]>,
  anchors: ReadonlyArray<readonly [number, number]>,
  segmentWidthFt: readonly number[],
): number[] {
  return course.map((p) => {
    let best = 0;
    let bestD = Infinity;
    for (let k = 0; k < segmentWidthFt.length && k + 1 < anchors.length; k++) {
      const a = anchors[k], b = anchors[k + 1];
      const vx = b[0] - a[0], vy = b[1] - a[1];
      const L2 = vx * vx + vy * vy;
      const u = L2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L2)) : 0;
      const d = Math.hypot(p[0] - a[0] - vx * u, p[1] - a[1] - vy * u);
      if (d < bestD) { bestD = d; best = k; }
    }
    return segmentWidthFt[best] / 2 + ROAD_RIVER_CLEAR_FT;
  });
}

type P2 = [number, number];

/** A river cut down to the segments near the road, with its clearance at each kept segment end. */
interface NearRiver {
  segs: Array<{ a: P2; b: P2; ca: number; cb: number }>;
  maxClear: number;
}

/** Nearest point on a river's segments, the unit normal to its left, and the clearance there. */
function nearestOnRiver(river: NearRiver, p: P2): { q: P2; n: P2; t: P2; d: number; clear: number } {
  let best = { q: [0, 0] as P2, n: [0, 1] as P2, t: [1, 0] as P2, d: Infinity, clear: 0 };
  for (const s of river.segs) {
    const vx = s.b[0] - s.a[0], vy = s.b[1] - s.a[1];
    const L = Math.hypot(vx, vy);
    if (L < 1e-12) continue;
    const u = Math.max(0, Math.min(1, ((p[0] - s.a[0]) * vx + (p[1] - s.a[1]) * vy) / (L * L)));
    const q: P2 = [s.a[0] + vx * u, s.a[1] + vy * u];
    const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < best.d) best = { q, n: [-vy / L, vx / L], t: [vx / L, vy / L], d, clear: s.ca + (s.cb - s.ca) * u };
  }
  return best;
}

/**
 * A ROAD KEEPS TO A BANK (GG-582). World roads follow the same chain of map
 * cells as the river in their valley, so at true scale a road can lie along
 * the river's center line (Borieborum, burg 702: 1,083 ft of approach road in
 * the water). This moves each stretch of road that comes nearer a river than
 * its clearance out onto the bank, at exactly that distance from the center
 * line.
 *
 * A stretch that leaves the water on the side it came from stays on that
 * bank. A stretch that leaves on the other side crosses the river once: at one
 * of the places where the atlas road itself changes bank, the one where it
 * meets the river most nearly at a right angle. The crossing itself runs
 * straight across, square to the river, for a bridge to carry.
 * Points that `keep` holds do not move (a field track keeps its gate end).
 * A held point still counts as part of its wet stretch, so the stretch keeps
 * one bank on both sides of it. Town points (GG-541) are not held: a river
 * town's center usually lies in its river, and a road held there runs into
 * the water; the town gives such a road a gate where it meets the wall. A road that never comes near a river comes back
 * unchanged, and so does each dry stretch of one that does.
 */
export function keepRoadOffRivers(
  road: ReadonlyArray<readonly [number, number]>,
  rivers: readonly RoadRiverReach[],
  keep: (p: readonly [number, number]) => boolean = () => false,
): P2[] {
  const copy = (): P2[] => road.map((p) => [p[0], p[1]]);
  if (road.length < 2) return copy();
  // Only the river segments within reach of the road's box take part.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of road) {
    minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
    minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
  }
  const live: NearRiver[] = [];
  for (const r of rivers) {
    const clearAt = (k: number): number => r.clearAt?.[k] ?? r.clear;
    const segs: NearRiver['segs'] = [];
    let maxClear = 0;
    for (let k = 0; k + 1 < r.line.length; k++) {
      const a = r.line[k], b = r.line[k + 1];
      const ca = clearAt(k), cb = clearAt(k + 1);
      const reach = Math.max(ca, cb);
      if (!(reach > 0)) continue;
      if (Math.max(a[0], b[0]) < minX - reach || Math.min(a[0], b[0]) > maxX + reach) continue;
      if (Math.max(a[1], b[1]) < minY - reach || Math.min(a[1], b[1]) > maxY + reach) continue;
      segs.push({ a: [a[0], a[1]], b: [b[0], b[1]], ca, cb });
      maxClear = Math.max(maxClear, reach);
    }
    if (segs.length > 0) live.push({ segs, maxClear });
  }
  if (live.length === 0) return copy();

  // Sample the road finely enough that no stretch skips over the water.
  let minClear = Infinity;
  for (const r of live) for (const s of r.segs) minClear = Math.min(minClear, s.ca, s.cb);
  const step = minClear / 2;
  const pts: P2[] = [];
  const held: boolean[] = [];
  // The road's own points; samples added between them are dropped again
  // where the road stays dry, so a dry stretch comes back unchanged.
  const own: boolean[] = [];
  for (let i = 0; i < road.length; i++) {
    const a = road[i];
    pts.push([a[0], a[1]]);
    held.push(keep(a));
    own.push(true);
    if (i === road.length - 1) break;
    const b = road[i + 1];
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step);
    for (let k = 1; k < n; k++) {
      pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
      held.push(false);
      own.push(false);
    }
  }

  // The river each sample is deepest into, and whether it is too near it.
  const near = pts.map((p) => {
    let best = { river: -1, into: -Infinity };
    live.forEach((r, ri) => {
      const hit = nearestOnRiver(r, p);
      const into = hit.clear - hit.d;
      if (into > best.into) best = { river: ri, into };
    });
    return best;
  });
  const wet = near.map((x) => x.into > 1e-9);
  if (!wet.some((w, i) => w && !held[i])) return copy();
  const sideOf = (i: number, ri: number): number => {
    const hit = nearestOnRiver(live[ri], pts[i]);
    return (pts[i][0] - hit.q[0]) * hit.n[0] + (pts[i][1] - hit.q[1]) * hit.n[1] >= 0 ? 1 : -1;
  };
  const onBank = (i: number, ri: number, side: number): P2 => {
    const hit = nearestOnRiver(live[ri], pts[i]);
    return [hit.q[0] + hit.n[0] * side * hit.clear, hit.q[1] + hit.n[1] * side * hit.clear];
  };

  const out: P2[] = [];
  let i = 0;
  while (i < pts.length) {
    if (!wet[i]) {
      // A dry sample stays only where it is one of the road's own points or
      // the last dry point before or after a moved stretch.
      if (own[i] || (i > 0 && wet[i - 1]) || (i + 1 < pts.length && wet[i + 1])) out.push(pts[i]);
      i++;
      continue;
    }
    let e = i;
    while (e + 1 < pts.length && wet[e + 1]) e++;
    const ri = near[i].river;
    // The side the road comes from and the side it leaves on.
    let before = i > 0 ? sideOf(i - 1, ri) : 0;
    let after = e + 1 < pts.length ? sideOf(e + 1, ri) : 0;
    if (!before && !after) {
      let sum = 0;
      for (let k = i; k <= e; k++) sum += sideOf(k, ri);
      before = after = sum >= 0 ? 1 : -1;
    }
    if (!before) before = after;
    if (!after) after = before;
    // A crossing: where the road itself changes bank, the sample where it runs
    // most nearly square to the river; the middle of the stretch wins a tie.
    // Keeping to a change of bank keeps the bridge where the atlas road
    // crosses: the squarest sample of a long stretch could lie a kilometer
    // away (world 42, cell 853: the highway's bridge left its window).
    let cross = -1;
    if (before !== after) {
      let bestSin = -1;
      const mid = (i + e) / 2;
      const flips = new Set<number>();
      for (let k = Math.max(1, i); k <= Math.min(e + 1, pts.length - 1); k++) {
        if (sideOf(k - 1, ri) !== sideOf(k, ri)) flips.add(Math.min(e, Math.max(i, k)));
      }
      for (let k = i; k <= e; k++) {
        if (held[k] || (flips.size > 0 && !flips.has(k))) continue;
        const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const t = nearestOnRiver(live[ri], pts[k]).t;
        const sin = Math.abs(((b[0] - a[0]) * t[1] - (b[1] - a[1]) * t[0]) / L);
        if (sin > bestSin + 1e-9 || (Math.abs(sin - bestSin) <= 1e-9 && Math.abs(k - mid) < Math.abs(cross - mid))) {
          bestSin = sin;
          cross = k;
        }
      }
    }
    for (let k = i; k <= e; k++) {
      if (held[k]) { out.push(pts[k]); continue; }
      if (k === cross) out.push(onBank(k, ri, before));
      out.push(onBank(k, ri, cross >= 0 && k >= cross ? after : before));
    }
    i = e + 1;
  }
  // Two samples pushed to the same bank point add nothing.
  return out.filter((p, k) => k === 0 || Math.hypot(p[0] - out[k - 1][0], p[1] - out[k - 1][1]) > 1e-9);
}

/**
 * How far past its own area each tier looks when it moves a road off a river
 * (GG-582), ft. The town looks this far past its square and the region this
 * far past its window, so each sees the whole of any wet stretch shorter than
 * this and the two tiers decide it the same way.
 */
export const ROAD_RIVER_CONTEXT_FT = 10_000;

/**
 * `keepRoadOffRivers` on the part of a world road near an area: from the
 * first to the last road point within `ROAD_RIVER_CONTEXT_FT` of the box. The
 * rest of the road comes back unchanged. Both tiers call this with the full
 * road course and the full river courses, in world feet.
 */
export function keepRoadOffRiversNear(
  road: ReadonlyArray<readonly [number, number]>,
  rivers: readonly RoadRiverReach[],
  box: { minX: number; minY: number; maxX: number; maxY: number },
  keep: (p: readonly [number, number]) => boolean = () => false,
): P2[] {
  const m = ROAD_RIVER_CONTEXT_FT;
  const inside = (p: readonly [number, number]) =>
    p[0] >= box.minX - m && p[0] <= box.maxX + m && p[1] >= box.minY - m && p[1] <= box.maxY + m;
  let first = road.findIndex(inside);
  if (first < 0 || rivers.length === 0) return road.map((p) => [p[0], p[1]]);
  let last = road.length - 1;
  while (last > first && !inside(road[last])) last--;
  first = Math.max(0, first - 1);
  last = Math.min(road.length - 1, last + 1);
  const moved = keepRoadOffRivers(road.slice(first, last + 1), rivers, keep);
  return [
    ...road.slice(0, first).map((p) => [p[0], p[1]] as P2),
    ...moved,
    ...road.slice(last + 1).map((p) => [p[0], p[1]] as P2),
  ];
}
