/**
 * @file polylineClip.ts
 * Clip a grid-space polyline (with per-point width) to a chunk's grid AABB.
 * Returns the contiguous runs that lie inside the chunk. Endpoints crossing the
 * boundary are interpolated (position + width) onto the AABB edge.
 *
 * Approach: parametric (Liang–Barsky) clipping per segment against the chunk's
 * axis-aligned bounds. Each input segment is clipped to the [t0, t1] sub-range
 * that lies inside the box; positions and per-point widths are linearly
 * interpolated at the clip parameters. Contiguous in-box segments are stitched
 * into a single run so an interior vertex shared by two clipped segments is not
 * duplicated. This preserves original vertices exactly when a segment is fully
 * inside (no densification), which matters for downstream mesh/width fidelity.
 */
import type { ClippedPolyline } from './types';
interface GridPt {
    x: number;
    y: number;
}
export declare function clipPolylineToChunk(points: GridPt[], width: number[], cx: number, cy: number): ClippedPolyline[];
export {};
