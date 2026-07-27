/**
 * @file utils/commonUtils.ts â€” ported from Azgaar's Fantasy-Map-Generator
 * (MIT). Upstream: .tmp/azgaar-src/src/utils/commonUtils.ts. See
 * ../ATTRIBUTION.md.
 *
 * Only clipPoly is ported â€” every other commonUtils helper (debounce, DOM
 * links, base64, coordinates formatting, prompt UI, ...) is browser/UI code
 * unused by the generation modules. Upstream clipPoly reads `graphWidth`/
 * `graphHeight` globals via a window wrapper; here they are explicit
 * parameters (cosmetic adaptation, same values flow in).
 */
import type { Point } from "../voronoi";
/**
 * Clip polygon points to graph boundaries
 * @param points - Array of points [[x1, y1], [x2, y2], ...]
 * @param graphWidth - Width of the graph
 * @param graphHeight - Height of the graph
 * @param secure - Secure clipping to avoid edge artifacts
 * @returns Clipped polygon points
 */
export declare const clipPoly: (points: Point[], graphWidth: number, graphHeight: number, secure?: number) => Point[];
/**
 * Generate a random date string between two years â€” verbatim port of
 * upstream src/utils/commonUtils.ts generateDate (added for Markers
 * battlefields). Draw order: rand(from,to), rand(12), rand(31). The Date
 * constructor here is deterministic (no Date.now), preserving the seed
 * contract.
 */
export declare const generateDate: (from?: number, to?: number) => string;
