/**
 * @file routeMapStyle.ts — ONE stroke language for routes on the 2D atlas.
 *
 * Both renderers (canvas atlasDraw + SVG AtlasLayers via buildRoutes) read this
 * table, so the map cannot show two different road languages. Visibility fade
 * comes from routeTerrain.routeVisibility — the same classification the travel
 * mechanics use, so "looks faint" and "is hard to follow" always agree.
 */
import type { RouteVisibility } from '../../systems/worldforge/travel/routeTerrain';
export interface RouteStroke {
    stroke: string;
    width: number;
    dash?: [number, number];
    casing?: {
        stroke: string;
        width: number;
    };
}
/** Stroke per route kind (atlas vocabulary: singular kinds). */
export declare const ROUTE_STROKES: Record<'highway' | 'road' | 'trail' | 'path' | 'searoute', RouteStroke>;
/** Final stroke opacity for a route segment of `kind` at `visibility`. */
export declare function routeOpacity(kind: string, visibility: RouteVisibility): number;
/** FMG plural group → atlas singular kind (render-side mirror of the adapter). */
export declare function groupToKind(group: string): keyof typeof ROUTE_STROKES;
/**
 * Split a route polyline into runs of constant visibility, sharing boundary
 * points so adjacent strokes stay continuous. Points are FMG [x, y, cellId].
 * The point where visibility flips closes the old run AND opens the new one,
 * so every run is emitted — a flip at the last point yields a trailing
 * single-point run; renderers skip segments with fewer than two points.
 */
export declare function segmentRouteByVisibility(points: number[][], visibilityOf: (cellId: number) => RouteVisibility): Array<{
    points: number[][];
    visibility: RouteVisibility;
}>;
