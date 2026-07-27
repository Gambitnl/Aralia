/**
 * @file townWaterBodies.ts — turn a town's inherited water polylines (rivers,
 * coast edges) into FILLED water-body polygons for the 3D ground bake's flat
 * water surface. Rivers buffer into a channel along their path; coast edges
 * extrude seaward (away from the town centre) into a harbour apron.
 *
 * Pure geometry, frame-agnostic — the caller passes coords in whatever frame it
 * renders (the 3D bake passes feet). Widths/depths are scalars the caller scales
 * from the town span.
 */
import type { Pt } from '../submap/submapEngine';
/** Buffer a polyline into a closed channel polygon, `halfWidth` to each side. */
export declare function bufferPolylineToChannel(line: Pt[], halfWidth: number): Pt[];
/**
 * Extrude a shore edge (a→b) outward into a TAPERED apron quad. "Outward" is the
 * edge normal pointing AWAY from `awayFrom` (the town centre), so the apron lands
 * seaward.
 *
 * TG6: a straight full-width seaward extrusion turns a harbour into one big
 * axis-aligned rectangle (reads lake-like / blocky). Instead the seaward edge is
 * pulled IN along the shore by `taper` of the edge length on each side, so the
 * apron narrows offshore into a trapezoid. Adjacent coast segments then overlap
 * into a continuous band that follows the shoreline rather than a hard block. A
 * larger `taper` (→0.5) makes the offshore edge a near-point; 0 keeps the legacy
 * rectangle.
 */
export declare function edgeApronQuad(a: Pt, b: Pt, awayFrom: Pt, depth: number, taper?: number): Pt[];
export interface TownWaterBodyInput {
    /** River crossing polylines (each buffered into a channel). */
    rivers: Pt[][];
    /** Coast boundary edges (each a short polyline; extruded seaward per segment). */
    coast: Pt[][];
    /** Town footprint centroid — the "inland" reference for outward apron direction. */
    centroid: Pt;
    /** Half-width of a river channel (same frame as the polylines). */
    channelHalfWidth: number;
    /** How far a coast apron reaches seaward. */
    apronDepth: number;
    /** Fraction of each coast segment's length to inset the offshore corners (0..0.49)
     *  so the apron tapers seaward instead of forming a blocky rectangle (TG6). Default 0.3. */
    apronTaper?: number;
}
/** Filled water-body polygons (one per river, one per coast segment). */
export declare function buildTownWaterBodies(input: TownWaterBodyInput): Pt[][];
