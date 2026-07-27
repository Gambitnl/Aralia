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
/**
 * @file multiModalRoute.ts - split a planned route into land and sea legs.
 *
 * The route planner returns one fastest path with one total distance. The map
 * needs a more readable shape for maritime travel: contiguous land and sea
 * segments for drawing different line styles, plus separate land/sea mileage
 * totals for the travel readout. This file performs only that classification.
 */
import type { RoutePlan } from './routePlanning';
import { type DockClass, type DockSize } from './dockTiers';
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
export declare function segmentRoute(route: RoutePlan, kindOf: (cell: number) => CellKind, milesPerUnit: number, options?: SegmentRouteOptions): MultiModalRoute;
