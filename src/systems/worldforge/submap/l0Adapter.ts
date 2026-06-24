/**
 * @file l0Adapter.ts — SP1 L0→L1 adapter (Milestone 2).
 *
 * Pure bridge: a real Azgaar/FMG atlas cell (`FmgAtlasResult`/`FmgWorldResult`)
 * → a root `SubmapParentContext` for the submap engine. The cell's Voronoi
 * polygon becomes the submap boundary; its biome and burg are inherited at their
 * exact graph-coord positions (identity preserved — the Bomnogorvan contract
 * source), and the seed-path descends `wf:<seed>/cell:<id>` so the submap
 * regenerates deterministically in isolation.
 *
 * Spec: SPEC §11 (2026-06-22) item 2 — Azgaar L0 → WF L1+; WF never generates a
 * competing world, it derives the submap from the parent cell.
 */
import { childSeedPath, type SeedPath } from '../seedPath';
import type { FmgAtlasResult } from '../fmg/generateAtlas';
import type { Pt, SubmapFeature, SubmapParentContext, SubmapPolyline } from './submapEngine';

/**
 * Build a root `SubmapParentContext` for atlas cell `cellId`.
 * @param atlas  the owned FMG atlas/world result (burgs only present on a world result)
 * @param cellId the pack cell id (the clicked Azgaar cell)
 * @param worldSeedPath the world root seed path (e.g. `rootSeedPath(seed)`)
 */
export function atlasCellToSubmapContext(
  atlas: FmgAtlasResult,
  cellId: number,
  worldSeedPath: SeedPath,
): SubmapParentContext {
  const cells = atlas.pack.cells;
  const verts = atlas.pack.vertices.p;

  // Cell Voronoi polygon (graph coords) = the submap boundary.
  const polygon: Pt[] = [];
  for (const v of cells.v[cellId] ?? []) {
    const p = verts[v];
    if (p) polygon.push([p[0], p[1]]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const biomeNames = (atlas.biomesData as any)?.name as string[] | undefined;
  const biome = biomeNames && cells.biome ? biomeNames[cells.biome[cellId]] : undefined;

  // Inherited set pieces at their exact positions (identity preserved).
  const features: SubmapFeature[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pack = atlas.pack as any;
  const burgId = cells.burg?.[cellId];
  if (burgId && pack.burgs?.[burgId] && !pack.burgs[burgId].removed) {
    const b = pack.burgs[burgId];
    features.push({ kind: 'burg', x: b.x, y: b.y, id: burgId, name: b.name });
  }

  // Inherited rivers/roads passing through this cell (full polylines; the engine
  // clips them to the cell boundary). Rivers: pack.rivers[].cells path; roads:
  // pack.routes[].points = [x, y, cellId] triples.
  const polylines: SubmapPolyline[] = [];
  for (const r of (pack.rivers ?? []) as Array<{ cells?: number[]; width?: number }>) {
    if (!(r.cells ?? []).includes(cellId)) continue;
    const pts: Pt[] = [];
    for (const c of r.cells ?? []) {
      const cp = cells.p[c];
      if (cp) pts.push([cp[0], cp[1]]);
    }
    if (pts.length >= 2) polylines.push({ kind: 'river', points: pts, width: r.width });
  }
  for (const rt of (pack.routes ?? []) as Array<{ points?: Array<[number, number, number]> }>) {
    const pts = rt.points ?? [];
    if (!pts.some((p) => p[2] === cellId)) continue;
    const line: Pt[] = pts.map((p) => [p[0], p[1]]);
    if (line.length >= 2) polylines.push({ kind: 'road', points: line });
  }

  return {
    polygon,
    seedPath: childSeedPath(worldSeedPath, `cell:${cellId}`),
    biome,
    features,
    polylines,
  };
}
