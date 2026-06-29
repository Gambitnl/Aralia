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
export function bufferPolylineToChannel(line: Pt[], halfWidth: number): Pt[] {
  if (line.length < 2) return [];
  const left: Pt[] = [];
  const right: Pt[] = [];
  const n = line.length;
  for (let i = 0; i < n; i++) {
    const prev = line[Math.max(0, i - 1)];
    const next = line[Math.min(n - 1, i + 1)];
    let tx = next[0] - prev[0];
    let ty = next[1] - prev[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len; ty /= len;
    const px = -ty; // left normal
    const py = tx;
    left.push([line[i][0] + px * halfWidth, line[i][1] + py * halfWidth]);
    right.push([line[i][0] - px * halfWidth, line[i][1] - py * halfWidth]);
  }
  right.reverse();
  return [...left, ...right];
}

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
export function edgeApronQuad(a: Pt, b: Pt, awayFrom: Pt, depth: number, taper = 0.3): Pt[] {
  let nx = -(b[1] - a[1]);
  let ny = b[0] - a[0];
  const len = Math.hypot(nx, ny) || 1;
  nx /= len; ny /= len;
  // Flip to point away from the town centre.
  const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if ((mid[0] - awayFrom[0]) * nx + (mid[1] - awayFrom[1]) * ny < 0) { nx = -nx; ny = -ny; }
  // Unit vector along the shore (a→b), used to inset the offshore corners.
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  const inset = Math.min(0.49, Math.max(0, taper)) * len;
  const farA: Pt = [a[0] + nx * depth + ux * inset, a[1] + ny * depth + uy * inset];
  const farB: Pt = [b[0] + nx * depth - ux * inset, b[1] + ny * depth - uy * inset];
  return [[a[0], a[1]], [b[0], b[1]], farB, farA];
}

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
export function buildTownWaterBodies(input: TownWaterBodyInput): Pt[][] {
  const out: Pt[][] = [];
  for (const r of input.rivers) {
    const ch = bufferPolylineToChannel(r, input.channelHalfWidth);
    if (ch.length >= 3) out.push(ch);
  }
  for (const edge of input.coast) {
    for (let i = 0; i < edge.length - 1; i++) {
      // Taper each seaward apron so the harbour follows the shore as a band of
      // overlapping trapezoids instead of one blocky rectangle (TG6).
      out.push(edgeApronQuad(edge[i], edge[i + 1], input.centroid, input.apronDepth, input.apronTaper ?? 0.3));
    }
  }
  return out;
}
