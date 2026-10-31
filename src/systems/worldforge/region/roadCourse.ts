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
