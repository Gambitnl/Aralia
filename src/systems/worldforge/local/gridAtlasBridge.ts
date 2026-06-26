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

/**
 * Map a legacy grid cell → the graph-space point to draw a marker/pin at: the
 * Voronoi SITE of the atlas cell it maps to, so the marker sits inside its actual
 * cell rather than the proportional grid-center (which drifts near coastlines).
 * Falls back to the grid-center point if the cell or its site is unavailable.
 * Shared by the player "you are here" marker and SP4 discovered-place pins.
 */
export function gridCellToAtlasSite(
  atlas: FmgAtlasResult,
  cell: GridCoord,
  gridSize: GridSize,
  /** Optional sub-tile offset in [-0.5, 0.5] per axis; nudges the point within
   *  the tile (in graph units = tile-size) so a marker reflects where inside the
   *  tile it actually sits. Kept small so the point stays near its land cell. */
  offset?: { x: number; y: number },
): [number, number] {
  const cellId = legacyGridToAtlasCell(atlas, cell, gridSize);
  const site = cellId >= 0 ? atlas.pack.cells.p?.[cellId] : undefined;
  const base: [number, number] = site ? [site[0], site[1]] : gridCellToGraphPoint(cell, gridSize, atlas);
  if (!offset) return base;
  const cols = gridSize.cols || 1;
  const rows = gridSize.rows || 1;
  return [
    base[0] + offset.x * (atlas.graphWidth / cols),
    base[1] + offset.y * (atlas.graphHeight / rows),
  ];
}

/**
 * Fan out points that resolve to the identical location so co-located markers
 * (e.g. several SP4 hidden places discovered in the same world tile, which all
 * snap to one Voronoi site) don't stack into one indistinguishable pin. Points
 * sharing a coordinate are spread on a small deterministic ring around it; unique
 * points pass through untouched. Order-stable (index-seeded), so it's frame-safe.
 */
export function spreadColocatedPoints<T extends { x: number; y: number }>(
  points: T[],
  radius = 6,
): T[] {
  const groups = new Map<string, number[]>();
  points.forEach((p, i) => {
    const key = `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    const g = groups.get(key);
    if (g) g.push(i); else groups.set(key, [i]);
  });
  const out = points.slice();
  for (const idxs of groups.values()) {
    if (idxs.length < 2) continue; // unique — leave as-is
    idxs.forEach((pointIndex, k) => {
      const angle = (2 * Math.PI * k) / idxs.length;
      out[pointIndex] = {
        ...out[pointIndex],
        x: points[pointIndex].x + Math.cos(angle) * radius,
        y: points[pointIndex].y + Math.sin(angle) * radius,
      };
    });
  }
  return out;
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
