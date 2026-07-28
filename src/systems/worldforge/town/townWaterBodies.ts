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

/**
 * What a water body IS. Height rules differ per kind and cannot be shared:
 * the sea is flat at zero by definition, a lake is flat at its own elevation,
 * and a river surface descends along its course. The old model had one flat
 * height for all three, so a river could only ever be a pond — which is how a
 * town 15 m above the sea ended up with its river drawn at sea level.
 */
export type TownWaterKind = 'sea' | 'river';

/** A filled water polygon plus what it is and, for rivers, where it came from. */
export interface TownWaterBody {
  points: Pt[];
  kind: TownWaterKind;
  /**
   * Rivers only: for each ring vertex, the index of the centerline point it was
   * offset from. Height is resolved along the centerline (which is ordered
   * downstream) and then read back onto the ring through this map.
   */
  sourceIndex?: number[];
  /** Rivers only: the ordered centerline the channel was buffered from. */
  centerline?: Pt[];
  /**
   * Sea aprons only: the two points of the shoreline this apron extends from.
   *
   * The apron reaches far out from land, so its outer corners sample ground that
   * says nothing about where the water meets the shore. Height has to come from
   * the shore edge itself. And it cannot simply be zero: a town's ground heights
   * are a LOCAL frame — one burg's shore sits at ~16 m in it — so assuming an
   * absolute sea level at zero buries the water under its own beach.
   */
  shoreEdge?: [Pt, Pt];
}

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
 * Same channel as `bufferPolylineToChannel`, plus the centerline index each ring
 * vertex was offset from. The ring is built left side forward then right side
 * reversed, so vertex i maps to centerline i for the left half and to
 * (n-1-j) for the right half.
 */
export function bufferPolylineToChannelIndexed(
  line: Pt[],
  halfWidth: number,
): { points: Pt[]; sourceIndex: number[] } {
  const points = bufferPolylineToChannel(line, halfWidth);
  if (points.length === 0) return { points, sourceIndex: [] };
  const n = line.length;
  const sourceIndex: number[] = [];
  for (let i = 0; i < n; i++) sourceIndex.push(i);
  for (let j = 0; j < n; j++) sourceIndex.push(n - 1 - j);
  return { points, sourceIndex };
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

/**
 * Filled water bodies (one channel per river, one apron per coast segment),
 * each tagged with what it is so the height pass can treat a river as a river.
 */
export function buildTownWaterBodies(input: TownWaterBodyInput): TownWaterBody[] {
  const out: TownWaterBody[] = [];
  for (const r of input.rivers) {
    const { points, sourceIndex } = bufferPolylineToChannelIndexed(r, input.channelHalfWidth);
    if (points.length >= 3) out.push({ points, kind: 'river', sourceIndex, centerline: r });
  }
  for (const edge of input.coast) {
    for (let i = 0; i < edge.length - 1; i++) {
      // Taper each seaward apron so the harbour follows the shore as a band of
      // overlapping trapezoids instead of one blocky rectangle (TG6).
      out.push({
        points: edgeApronQuad(edge[i], edge[i + 1], input.centroid, input.apronDepth, input.apronTaper ?? 0.3),
        kind: 'sea',
        shoreEdge: [edge[i], edge[i + 1]],
      });
    }
  }
  return out;
}
