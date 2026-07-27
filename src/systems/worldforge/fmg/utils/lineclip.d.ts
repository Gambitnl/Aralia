/**
 * @file utils/lineclip.ts — Sutherland-Hodgman polygon clipping, ported from
 * the lineclip library by mourner (https://github.com/mapbox/lineclip, ISC)
 * as vendored (and modified with the `secure` parameter) by Azgaar's
 * Fantasy-Map-Generator at .tmp/azgaar-src/public/libs/lineclip.min.js.
 * See ../ATTRIBUTION.md. Only `polygonclip` is ported — the polyline
 * `lineclip` entry point is unused by the generation modules.
 */
import type { Point } from "../voronoi";
export type BBox = [number, number, number, number];
/**
 * Sutherland-Hodgman polygon clipping against the bbox. When `secure` is
 * truthy, every inserted intersection point is pushed twice more (FMG's
 * modification used to secure curve rendering near the map edge).
 */
export declare function polygonclip(points: Point[], bbox: BBox, secure?: number): Point[];
