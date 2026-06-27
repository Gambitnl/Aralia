/**
 * @file cellFeatures.ts — extract a burg cell's inherited water & roads from the
 * FMG atlas, in ATLAS-PIXEL coords, so {@link canonicalTown} can fold them into
 * the single canonical town plan (docks, bridges, road-continued main streets).
 *
 * These are pure reads of the shared atlas keyed by burgId, so the 2D drill and
 * the 3D bake derive byte-identical inputs — identity is preserved (both views
 * call `getCanonicalTownPlan`, which generates once and transforms the result).
 *
 * Frame note: everything here is atlas-pixel space (the same frame as the cell
 * polygon). `canonicalTown` applies the cell-normalisation affine to these
 * polylines so they land in the town's normalised footprint frame.
 */
import { clipPolylineToPolygon, type Pt } from '../submap/submapEngine';
import type { FmgWorldResult } from '../fmg/generateWorld';

/** Minimal atlas surface this module reads (satisfied by FmgWorldResult). */
export type TownAtlas = Pick<FmgWorldResult, 'pack'>;

/** FMG land threshold — cells with height < 20 are water. */
const WATER_HEIGHT = 20;

const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** The burg's home FMG cell index. */
export function burgCellId(atlas: TownAtlas, burgId: number): number {
  const burg = atlas.pack.burgs?.[burgId];
  if (burg && typeof burg.cell === 'number') return burg.cell;
  // Fallback to the reverse map only if the burg lacks an explicit cell.
  const byCell = atlas.pack.cells.burg;
  if (byCell) {
    for (let i = 0; i < byCell.length; i++) if (byCell[i] === burgId) return i;
  }
  throw new Error(`cellFeatures: burg ${burgId} has no home cell`);
}

/** The burg's home-cell Voronoi polygon in atlas-pixel coords (the town footprint). */
export function burgCellPolygon(atlas: TownAtlas, burgId: number): Pt[] {
  const cellId = burgCellId(atlas, burgId);
  const vIds = atlas.pack.cells.v[cellId];
  if (!vIds) throw new Error(`cellFeatures: cell ${cellId} has no vertices`);
  const poly: Pt[] = [];
  for (const vid of vIds) {
    const p = atlas.pack.vertices.p[vid];
    if (p) poly.push([p[0], p[1]]);
  }
  return poly;
}

/** Water-facing boundary edges of a coastal cell (each a 2-point polyline). */
function cellCoastEdges(atlas: TownAtlas, cellId: number): Pt[][] {
  const pack = atlas.pack as any;
  const vids: number[] = pack.cells.v[cellId] ?? [];
  const vc: ArrayLike<number[]> | undefined = pack.vertices.c;
  const vp = pack.vertices.p;
  const h: ArrayLike<number> | undefined = pack.cells.h;
  if (!vc || !h) return [];
  const edges: Pt[][] = [];
  const n = vids.length;
  for (let i = 0; i < n; i++) {
    const va = vids[i];
    const vb = vids[(i + 1) % n];
    const ca = vc[va] ?? [];
    const cb = vc[vb] ?? [];
    // The neighbour across edge (va,vb) is the cell shared by both verts ≠ this cell.
    let neighbour = -1;
    for (const c of ca) if (c !== cellId && cb.includes(c)) { neighbour = c; break; }
    if (neighbour < 0) continue; // open map border, not a coast
    if ((h[neighbour] ?? 100) < WATER_HEIGHT) {
      const pa = vp[va];
      const pb = vp[vb];
      if (pa && pb) edges.push([[pa[0], pa[1]], [pb[0], pb[1]]]);
    }
  }
  return edges;
}

/**
 * Inherited rivers + coast for the burg cell as atlas-pixel polylines.
 *
 * - Rivers: for each river whose cell sequence passes through the cell, emit a
 *   local crossing segment `[mid(prev,cur), cur, mid(cur,next)]` (a half-segment
 *   when the cell is the river's source or mouth) so the line actually crosses
 *   the footprint — seating riverside docks and bridges between wards.
 * - Coast: every water-facing boundary edge of a coastal cell, so waterfront
 *   wards seat docks on the true harbour side.
 */
export function cellWaterPolylines(atlas: TownAtlas, burgId: number): Pt[][] {
  const pack = atlas.pack as any;
  const cellId = burgCellId(atlas, burgId);
  const cellsP = pack.cells.p;
  const out: Pt[][] = [];

  const rivers: any[] = pack.rivers ?? [];
  for (const r of rivers) {
    const seq: number[] = (r.cells ?? []).filter((c: number) => c >= 0);
    const idx = seq.indexOf(cellId);
    if (idx < 0) continue;
    const cur = cellsP[cellId];
    if (!cur) continue;
    const seg: Pt[] = [];
    if (idx > 0 && cellsP[seq[idx - 1]]) seg.push(mid(cellsP[seq[idx - 1]], cur));
    seg.push([cur[0], cur[1]]);
    if (idx < seq.length - 1 && cellsP[seq[idx + 1]]) seg.push(mid(cur, cellsP[seq[idx + 1]]));
    if (seg.length >= 2) out.push(seg);
  }

  if ((pack.cells.harbor?.[cellId] ?? 0) > 0) {
    out.push(...cellCoastEdges(atlas, cellId));
  }
  return out;
}

/**
 * Inherited regional roads passing through the burg cell, clipped to the cell
 * polygon (atlas-pixel coords). Searoutes are excluded; land roads and trails
 * become continued main streets in {@link canonicalTown}.
 */
export function cellRoadPolylines(atlas: TownAtlas, burgId: number): Pt[][] {
  const pack = atlas.pack as any;
  const cellPoly = burgCellPolygon(atlas, burgId);
  const routes: any[] = pack.routes ?? [];
  const out: Pt[][] = [];
  for (const r of routes) {
    if (r.group !== 'roads' && r.group !== 'trails') continue;
    const pts: Pt[] = r.points ?? [];
    if (pts.length < 2) continue;
    for (const seg of clipPolylineToPolygon(pts, cellPoly)) {
      if (seg.length >= 2) out.push(seg);
    }
  }
  return out;
}
