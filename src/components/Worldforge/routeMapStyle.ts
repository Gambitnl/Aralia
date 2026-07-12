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
  casing?: { stroke: string; width: number };
}

/** Stroke per route kind (atlas vocabulary: singular kinds). */
export const ROUTE_STROKES: Record<'highway' | 'road' | 'trail' | 'path' | 'searoute', RouteStroke> = {
  highway: { stroke: '#b8894a', width: 1.6, casing: { stroke: '#4a3520', width: 2.4 } },
  road: { stroke: '#8b5a2b', width: 1.2 },
  trail: { stroke: '#708090', width: 0.8, dash: [3, 3] },
  path: { stroke: '#6b7280', width: 0.6, dash: [1, 2.5] },
  searoute: { stroke: '#87cefa', width: 1.0, dash: [4, 4] },
};

/** Base opacity per kind (paths are subtle even in the open). */
const KIND_BASE_OPACITY: Record<string, number> = { path: 0.55 };
const VISIBILITY_OPACITY: Record<RouteVisibility, number> = { visible: 1, faint: 0.35, overgrown: 0.2 };

/** Final stroke opacity for a route segment of `kind` at `visibility`. */
export function routeOpacity(kind: string, visibility: RouteVisibility): number {
  if (visibility !== 'visible') return VISIBILITY_OPACITY[visibility];
  return KIND_BASE_OPACITY[kind] ?? 1;
}

/** FMG plural group → atlas singular kind (render-side mirror of the adapter). */
export function groupToKind(group: string): keyof typeof ROUTE_STROKES {
  if (group === 'highways') return 'highway';
  if (group === 'roads') return 'road';
  if (group === 'trails') return 'trail';
  if (group === 'paths') return 'path';
  return 'searoute';
}

/**
 * Split a route polyline into runs of constant visibility, sharing boundary
 * points so adjacent strokes stay continuous. Points are FMG [x, y, cellId].
 * The point where visibility flips closes the old run AND opens the new one,
 * so every run is emitted — a flip at the last point yields a trailing
 * single-point run; renderers skip segments with fewer than two points.
 */
export function segmentRouteByVisibility(
  points: number[][],
  visibilityOf: (cellId: number) => RouteVisibility,
): Array<{ points: number[][]; visibility: RouteVisibility }> {
  if (points.length < 2) return [];
  const out: Array<{ points: number[][]; visibility: RouteVisibility }> = [];
  let run: number[][] = [points[0]];
  let vis = visibilityOf(points[0][2]);
  for (let i = 1; i < points.length; i++) {
    const v = visibilityOf(points[i][2]);
    run.push(points[i]);
    if (v !== vis) {
      out.push({ points: run, visibility: vis });
      run = [points[i]];
      vis = v;
    }
  }
  out.push({ points: run, visibility: vis });
  return out;
}
