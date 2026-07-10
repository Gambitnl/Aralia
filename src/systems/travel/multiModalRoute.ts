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
import { dockClassFitsPort, type DockClass, type DockSize } from './dockTiers';

/** The two things a world cell can be for travel: dry land or open water. */
export type CellKind = 'land' | 'sea';

/**
 * A drawable leg kind. `land` and `sea` mirror the cell kinds; `tender` is the
 * short row ashore when a ship is too large to berth at the destination dock
 * (travel G14) — its own kind so the readout/line can style it distinctly.
 */
export type SegmentKind = 'land' | 'sea' | 'tender';

export interface RouteSegment {
  kind: SegmentKind;
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
  /** Miles rowed ashore by tender (ship too large for the destination dock). Optional: only the multimodal builder sets it; hand-built routes omit it. */
  tenderMiles?: number;
  minutes: number;
  danger: number;
}

/**
 * Optional dock-tier inputs (travel G14). When supplied, the segmenter checks
 * whether the arriving vehicle can berth at its destination dock; if not, it
 * peels the final water-to-shore approach off as a `tender` leg.
 */
export interface TenderOptions {
  /** Berth size the arriving water vehicle needs. */
  vehicleDockClass: DockClass;
  /** Dock size at a given cell (derived at plan time; see dockSizeForPort). */
  dockSizeOf: (cell: number) => DockSize;
}

export interface SegmentRouteOptions {
  tender?: TenderOptions;
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
/**
 * The edge index at which a tender leg is required, or -1 for none.
 *
 * The berth is the final water-to-shore arrival: the greatest edge `i` where the
 * route enters land (`cells[i]`) directly from water (`cells[i-1]`). That cell is
 * where the ship would tie up. If the vehicle's dock class does not fit that
 * port's dock size, the ship cannot berth and that final approach edge becomes a
 * tender leg. Pure — reads only the classifier and the caller's dock lookups.
 */
function tenderEdgeIndex(
  route: RoutePlan,
  kindOf: (cell: number) => CellKind,
  tender: TenderOptions,
): number {
  for (let i = route.cells.length - 1; i >= 1; i--) {
    if (kindOf(route.cells[i]) === 'land' && kindOf(route.cells[i - 1]) === 'sea') {
      const dockSize = tender.dockSizeOf(route.cells[i]);
      return dockClassFitsPort(tender.vehicleDockClass, dockSize) ? -1 : i;
    }
  }
  return -1;
}

/**
 * Split a route into contiguous land/sea legs.
 *
 * The kind of an edge is the kind of the cell being entered. That makes the
 * harbor boundary intuitive: the line changes style as soon as the route enters
 * the first sea cell, then changes back when it enters land at the next port.
 *
 * When `options.tender` is supplied and the arriving vehicle is too large for the
 * destination dock (travel G14), the final water-to-shore approach is emitted as
 * a `tender` leg instead of land, and its miles are tallied under `tenderMiles`.
 * Without that option the behavior is unchanged (byte-identical to before).
 */
export function segmentRoute(
  route: RoutePlan,
  kindOf: (cell: number) => CellKind,
  milesPerUnit: number,
  options?: SegmentRouteOptions,
): MultiModalRoute {
  const segments: RouteSegment[] = [];
  let landMiles = 0;
  let seaMiles = 0;
  let tenderMiles = 0;

  const tenderEdge = options?.tender ? tenderEdgeIndex(route, kindOf, options.tender) : -1;

  for (let i = 1; i < route.cells.length; i++) {
    const kind: SegmentKind = i === tenderEdge ? 'tender' : kindOf(route.cells[i]);
    const start = route.points[i - 1];
    const end = route.points[i];
    const miles = distance(start, end) * milesPerUnit;

    if (kind === 'land') {
      landMiles += miles;
    } else if (kind === 'sea') {
      seaMiles += miles;
    } else {
      tenderMiles += miles;
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
    tenderMiles,
    minutes: route.minutes,
    danger: route.danger,
  };
}
