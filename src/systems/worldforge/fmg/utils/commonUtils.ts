/**
 * @file utils/commonUtils.ts — ported from Azgaar's Fantasy-Map-Generator
 * (MIT). Upstream: .tmp/azgaar-src/src/utils/commonUtils.ts. See
 * ../ATTRIBUTION.md.
 *
 * Only clipPoly is ported — every other commonUtils helper (debounce, DOM
 * links, base64, coordinates formatting, prompt UI, ...) is browser/UI code
 * unused by the generation modules. Upstream clipPoly reads `graphWidth`/
 * `graphHeight` globals via a window wrapper; here they are explicit
 * parameters (cosmetic adaptation, same values flow in).
 */
import type { Point } from "../voronoi";
import { polygonclip } from "./lineclip";

/**
 * Clip polygon points to graph boundaries
 * @param points - Array of points [[x1, y1], [x2, y2], ...]
 * @param graphWidth - Width of the graph
 * @param graphHeight - Height of the graph
 * @param secure - Secure clipping to avoid edge artifacts
 * @returns Clipped polygon points
 */
export const clipPoly = (
  points: Point[],
  graphWidth: number,
  graphHeight: number,
  secure: number = 0,
): Point[] => {
  if (points.length < 2) return points;
  if (points.some((point) => point === undefined)) {
    // upstream: window.ERROR && console.error("Undefined point in clipPoly", points)
    return points;
  }

  return polygonclip(points, [0, 0, graphWidth, graphHeight], secure);
};
