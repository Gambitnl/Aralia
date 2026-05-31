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
import { chunkGridAABB } from './coords';

interface GridPt {
  x: number;
  y: number;
}

const EPS = 1e-9;

interface ClipResult {
  t0: number;
  t1: number;
}

/**
 * Liang–Barsky parametric clip of segment a→b against the AABB.
 * Returns the [t0, t1] sub-interval (within [0, 1]) inside the box, or null
 * if the segment lies entirely outside.
 */
function clipSegment(
  a: GridPt,
  b: GridPt,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): ClipResult | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;

  const edges: Array<[number, number]> = [
    [-dx, a.x - minX], // left:   x >= minX
    [dx, maxX - a.x], //  right:  x <= maxX
    [-dy, a.y - minY], // bottom: y >= minY
    [dy, maxY - a.y], //  top:    y <= maxY
  ];

  for (const [p, q] of edges) {
    if (Math.abs(p) < EPS) {
      // Line parallel to this edge: if it's outside the slab, reject entirely.
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      // Entering: tighten the lower bound.
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      // Exiting: tighten the upper bound.
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }

  if (t1 - t0 < EPS) return null;
  return { t0, t1 };
}

export function clipPolylineToChunk(
  points: GridPt[],
  width: number[],
  cx: number,
  cy: number,
): ClippedPolyline[] {
  if (points.length < 2) return [];
  const { minGX, minGY, maxGX, maxGY } = chunkGridAABB(cx, cy);

  const out: ClippedPolyline[] = [];
  let cur: { points: GridPt[]; width: number[] } | null = null;

  const flush = () => {
    if (cur && cur.points.length >= 2) out.push({ points: cur.points, width: cur.width });
    cur = null;
  };

  const lerp = (u: number, v: number, t: number) => u + (v - u) * t;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const wa = width[i] ?? 1;
    const wb = width[i + 1] ?? wa;

    const clip = clipSegment(a, b, minGX, minGY, maxGX, maxGY);
    if (!clip) {
      // Segment entirely outside: terminate any in-progress run.
      flush();
      continue;
    }

    const { t0, t1 } = clip;
    const start: GridPt =
      t0 <= EPS ? a : { x: lerp(a.x, b.x, t0), y: lerp(a.y, b.y, t0) };
    const startW = t0 <= EPS ? wa : lerp(wa, wb, t0);
    const end: GridPt =
      t1 >= 1 - EPS ? b : { x: lerp(a.x, b.x, t1), y: lerp(a.y, b.y, t1) };
    const endW = t1 >= 1 - EPS ? wb : lerp(wa, wb, t1);

    // A run can only continue across the shared vertex `a` if the previous
    // segment ended exactly at `a` (t1 was 1) and this one starts at `a` (t0 0).
    if (cur && t0 <= EPS) {
      // Shared vertex already present as the last point of `cur`; append end.
      cur.points.push(end);
      cur.width.push(endW);
    } else {
      flush();
      cur = { points: [start], width: [startW] };
      cur.points.push(end);
      cur.width.push(endW);
    }

    // If this segment exits the box before reaching b, the run ends here.
    if (t1 < 1 - EPS) flush();
  }

  flush();
  return out;
}
