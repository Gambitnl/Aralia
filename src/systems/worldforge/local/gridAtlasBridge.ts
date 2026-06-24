/**
 * @file gridAtlasBridge.ts — legacy grid ↔ WF atlas-cell coordinate bridge.
 *
 * The legacy world model addresses places by a square grid coordinate
 * (`mapData.tiles[y][x]`, a.k.a. `parentWorldMapCoords` / `subMapCoordinates`),
 * while the owned WF atlas addresses them by Voronoi cell id over a graph of
 * `graphWidth × graphHeight`. This module is the missing bridge between the two
 * frames — the keystone both the WF-backed local content provider (Phase 3) and
 * SP4's atlas pins depend on.
 *
 * The mapping mirrors `worldforgeMarker` in MapPane: a grid cell maps to the
 * proportional point in graph space (cell-center), and the atlas cell is the
 * nearest Voronoi site to that point. Pure: no React/DOM.
 */
import type { FmgAtlasResult } from '../fmg/generateAtlas';

export interface GridCoord { x: number; y: number }
export interface GridSize { cols: number; rows: number }

/** Cell-center of a grid cell, projected into atlas graph coords. */
export function gridCellToGraphPoint(
  cell: GridCoord,
  gridSize: GridSize,
  atlas: Pick<FmgAtlasResult, 'graphWidth' | 'graphHeight'>,
): [number, number] {
  const cols = gridSize.cols || 1;
  const rows = gridSize.rows || 1;
  return [
    ((cell.x + 0.5) / cols) * atlas.graphWidth,
    ((cell.y + 0.5) / rows) * atlas.graphHeight,
  ];
}

/** Nearest Voronoi cell id to a graph point (owned nearest-site lookup). */
function nearestCell(atlas: FmgAtlasResult, gx: number, gy: number): number {
  const p = atlas.pack.cells.p;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (!c) continue;
    const dx = c[0] - gx;
    const dy = c[1] - gy;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** Map a legacy grid cell → the WF atlas cell id covering it (-1 if none). */
export function legacyGridToAtlasCell(
  atlas: FmgAtlasResult,
  cell: GridCoord,
  gridSize: GridSize,
): number {
  const [gx, gy] = gridCellToGraphPoint(cell, gridSize, atlas);
  return nearestCell(atlas, gx, gy);
}

/** Map a WF atlas cell id → the legacy grid cell containing its site. */
export function atlasCellToLegacyGrid(
  atlas: FmgAtlasResult,
  cellId: number,
  gridSize: GridSize,
): GridCoord | null {
  const site = atlas.pack.cells.p[cellId];
  if (!site) return null;
  const cols = gridSize.cols || 1;
  const rows = gridSize.rows || 1;
  const x = Math.min(cols - 1, Math.max(0, Math.floor((site[0] / (atlas.graphWidth || 1)) * cols)));
  const y = Math.min(rows - 1, Math.max(0, Math.floor((site[1] / (atlas.graphHeight || 1)) * rows)));
  return { x, y };
}
