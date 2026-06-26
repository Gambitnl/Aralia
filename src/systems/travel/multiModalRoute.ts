// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/06/2026, 18:30:09
 * Dependents: components/Worldforge/AtlasSvgView.tsx, systems/travel/travelReadout.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file multiModalRoute.ts - split a planned route into land and sea legs.
 *
 * The route planner returns one fastest path with one total distance. The map
 * needs a more readable shape for maritime travel: contiguous land and sea
 * segments for drawing different line styles, plus separate land/sea mileage
 * totals for the travel readout. This file performs only that classification.
 */
import type { RoutePlan } from './routePlanning';

export type CellKind = 'land' | 'sea';

export interface RouteSegment {
  kind: CellKind;
  /** Polyline points for this leg; neighboring legs share their boundary point. */
  points: Array<[number, number]>;
}

export interface MultiModalRoute {
  cells: number[];
  points: Array<[number, number]>;
  segments: RouteSegment[];
  miles: number;
  landMiles: number;
  seaMiles: number;
  minutes: number;
  danger: number;
}

// ============================================================================
// Segment Helpers
// ============================================================================
// This section keeps the segment math small and explicit. Segment distance is
// measured from the route's point geometry so UI output matches the drawn line.
// ============================================================================

function distance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/**
 * Split a route into contiguous land/sea legs.
 *
 * The kind of an edge is the kind of the cell being entered. That makes the
 * harbor boundary intuitive: the line changes style as soon as the route enters
 * the first sea cell, then changes back when it enters land at the next port.
 */
export function segmentRoute(
  route: RoutePlan,
  kindOf: (cell: number) => CellKind,
  milesPerUnit: number,
): MultiModalRoute {
  const segments: RouteSegment[] = [];
  let landMiles = 0;
  let seaMiles = 0;

  for (let i = 1; i < route.cells.length; i++) {
    const kind = kindOf(route.cells[i]);
    const start = route.points[i - 1];
    const end = route.points[i];
    const miles = distance(start, end) * milesPerUnit;

    if (kind === 'land') {
      landMiles += miles;
    } else {
      seaMiles += miles;
    }

    const last = segments[segments.length - 1];
    if (last && last.kind === kind) {
      last.points.push(end);
    } else {
      segments.push({ kind, points: [start, end] });
    }
  }

  return {
    cells: route.cells,
    points: route.points,
    segments,
    miles: route.miles,
    landMiles,
    seaMiles,
    minutes: route.minutes,
    danger: route.danger,
  };
}
