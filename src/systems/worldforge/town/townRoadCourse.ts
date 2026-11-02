/**
 * @file townRoadCourse.ts — the world roads at a town, in the normalized town
 * frame, at TRUE scale.
 *
 * The old path fed the town generator `cellRoadPolylines`, which rides
 * `canonAffine`: the burg CELL's bounding box shrunk to CANON_TOWN_SPAN, about
 * 30x for a town. Every route that crossed the cell became a street through
 * the town, aimed where the shrunk cell put it, and it stopped at the town
 * edge. The wilderness road, drawn at true scale, ran somewhere else. At
 * Tineroe (GG-541) the nearest town road end was 255 m from the trail.
 *
 * This module builds each route's course with the SAME function the region tier
 * uses (`roadCourseFt`, pinned at every burg), then maps it into the town frame
 * by the inverse of the town placement, the same way `townRiverCourse` does for
 * the river. A route that serves this burg runs through the town center; the
 * town's approach road and the wilderness road are one line.
 */
import { clipPolylineToPolygon, type Pt } from '../submap/submapEngine';
import type { FmgWorldResult } from '../fmg/generateWorld';
import { keepRoadOffRiversNear, roadCourseFt, type RoadRiverReach, type RoutePoint } from '../region/roadCourse';
import { townSpanFtForPeople, POPULATION_RATE, CANON_TOWN_SPAN } from './townScale';
import { FEET_PER_FMG_PIXEL } from '../adapter/atlasArtifact';

/** Minimal atlas surface this module reads (satisfied by FmgWorldResult). */
type TownAtlas = Pick<FmgWorldResult, 'pack'>;

/**
 * The world's land roads near this burg, in the normalized town frame (origin
 * at town center, CANON_TOWN_SPAN across), clipped to the town square.
 * Searoutes are not roads. A route that only passes near the town shows only
 * if its true course crosses the town square.
 *
 * `rivers` (GG-582, world feet, from `townRiverRoadReachFt`): the course
 * keeps to a bank of each, by the rule the region tier applies to the same
 * road (`keepRoadOffRiversNear`), so the moved road is still the world road.
 * Absent = the course as the atlas routes it (layout revision 1).
 */
export function townRoadCourseCanon(atlas: TownAtlas, burgId: number, rivers: readonly RoadRiverReach[] = []): Pt[][] {
  const pack = atlas.pack as unknown as {
    cells: { burg?: ArrayLike<number> };
    burgs?: Array<{ x: number; y: number; removed?: boolean; population?: number }>;
    routes?: Array<{ group?: string; points?: RoutePoint[] }>;
  };
  const burg = pack.burgs?.[burgId];
  if (!burg || burg.removed) return [];
  const cellBurg = pack.cells.burg;
  if (!cellBurg) throw new Error(`[town] The atlas has no cell-to-burg table for burg ${burgId}.`);

  // Inverse of the town placement (the region tier centers the envelope on the
  // burg, see generateRegion `generateCivData`), as in townRiverCourse.
  const spanFt = townSpanFtForPeople((burg.population ?? 0) * POPULATION_RATE);
  const cxFt = burg.x * FEET_PER_FMG_PIXEL;
  const cyFt = burg.y * FEET_PER_FMG_PIXEL;
  const k = CANON_TOWN_SPAN / spanFt;
  const half = CANON_TOWN_SPAN / 2;
  const square: Pt[] = [[-half, -half], [half, -half], [half, half], [-half, half]];
  // A route whose raw points all lie farther than this from the town cannot
  // cross the town square after smoothing (Chaikin stays inside the hull).
  const reachFt = spanFt;

  const out: Pt[][] = [];
  for (const route of pack.routes ?? []) {
    if (route.group === 'searoutes') continue;
    const points = route.points ?? [];
    if (points.length < 2) continue;
    // Cheap reject: the route's bounding box must reach the town.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      const x = p[0] * FEET_PER_FMG_PIXEL;
      const y = p[1] * FEET_PER_FMG_PIXEL;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (cxFt < minX - reachFt || cxFt > maxX + reachFt || cyFt < minY - reachFt || cyFt > maxY + reachFt) continue;

    const pinned = roadCourseFt(points, FEET_PER_FMG_PIXEL, cellBurg);
    const course = rivers.length > 0
      ? keepRoadOffRiversNear(pinned, rivers, { minX: cxFt - spanFt / 2, minY: cyFt - spanFt / 2, maxX: cxFt + spanFt / 2, maxY: cyFt + spanFt / 2 })
      : pinned;
    const canon: Pt[] = course.map(([x, y]) => [(x - cxFt) * k, (y - cyFt) * k]);
    for (const seg of clipPolylineToPolygon(canon, square)) {
      if (seg.length >= 2) out.push(seg);
    }
  }
  return out;
}
