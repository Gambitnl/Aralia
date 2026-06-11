/**
 * @file utils/lineclip.ts — Sutherland-Hodgman polygon clipping, ported from
 * the lineclip library by mourner (https://github.com/mapbox/lineclip, ISC)
 * as vendored (and modified with the `secure` parameter) by Azgaar's
 * Fantasy-Map-Generator at .tmp/azgaar-src/public/libs/lineclip.min.js.
 * See ../ATTRIBUTION.md. Only `polygonclip` is ported — the polyline
 * `lineclip` entry point is unused by the generation modules.
 */
import type { Point } from "../voronoi";

export type BBox = [number, number, number, number]; // [xmin, ymin, xmax, ymax]

/**
 * Bit code reflects the point position relative to the bbox:
 *         left  mid  right
 *    top  1001  1000  1010
 *    mid  0001  0000  0010
 * bottom  0101  0100  0110
 */
function bitCode(p: Point, bbox: BBox): number {
  let code = 0;
  if (p[0] < bbox[0]) code |= 1; // left
  else if (p[0] > bbox[2]) code |= 2; // right
  if (p[1] < bbox[1]) code |= 4; // bottom
  else if (p[1] > bbox[3]) code |= 8; // top
  return code;
}

/** Intersect a segment against one of the 4 bbox edges. */
function intersect(a: Point, b: Point, edge: number, bbox: BBox): Point {
  return edge & 8
    ? [a[0] + ((b[0] - a[0]) * (bbox[3] - a[1])) / (b[1] - a[1]), bbox[3]] // top
    : edge & 4
      ? [a[0] + ((b[0] - a[0]) * (bbox[1] - a[1])) / (b[1] - a[1]), bbox[1]] // bottom
      : edge & 2
        ? [bbox[2], a[1] + ((b[1] - a[1]) * (bbox[2] - a[0])) / (b[0] - a[0])] // right
        : edge & 1
          ? [bbox[0], a[1] + ((b[1] - a[1]) * (bbox[0] - a[0])) / (b[0] - a[0])] // left
          : (null as unknown as Point); // unreachable for edge in {1,2,4,8}
}

/**
 * Sutherland-Hodgman polygon clipping against the bbox. When `secure` is
 * truthy, every inserted intersection point is pushed twice more (FMG's
 * modification used to secure curve rendering near the map edge).
 */
export function polygonclip(
  points: Point[],
  bbox: BBox,
  secure: number = 0,
): Point[] {
  let result: Point[] = [];
  let prev: Point;
  let prevInside: boolean;

  // clip against each side of the clip window
  for (let edge = 1; edge <= 8; edge *= 2) {
    result = [];
    prev = points[points.length - 1];
    prevInside = !(bitCode(prev, bbox) & edge);

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const inside = !(bitCode(p, bbox) & edge);
      const crossing = inside !== prevInside;

      // if segment goes through the clip window, add an intersection point
      if (crossing) {
        const intersection = intersect(prev, p, edge, bbox);
        result.push(intersection);
        if (secure) result.push(intersection, intersection);
      }
      if (inside) result.push(p); // add a point if it's inside

      prev = p;
      prevInside = inside;
    }

    points = result;
    if (!points.length) break;
  }

  return result;
}
