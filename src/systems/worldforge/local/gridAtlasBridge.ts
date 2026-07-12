/**
 * @file gridAtlasBridge.ts — WF atlas-cell spatial helpers (cell-native world).
 *
 * Grid retirement (Cell-Native World): the legacy square-grid ↔ atlas-cell
 * coordinate bridge that used to live here is GONE. The world addresses places
 * by Voronoi cell id over a graph of `graphWidth × graphHeight` — there is no
 * 30×20 grid frame to translate to or from anymore.
 *
 * What remains are pure atlas-space helpers the owned map still depends on:
 * land-snapping a cell, resolving a cell's 3D-entry anchor, and fanning out
 * co-located map pins. The anchor keeps one canonical cell identity while an
 * optional town coordinate only changes the camera window inside that cell.
 * Pure: no React/DOM.
 */
import type { FmgAtlasResult } from '../fmg/generateAtlas';
import type { Entry3DAnchor } from '../../../types/state';

/** Land threshold — a cell is land when its height ≥ this (mirrors FMG / the
 *  atlas land rule). The ONE place this rule lives. */
const LAND_H = 20;

/**
 * Snap an atlas cell to the nearest LAND cell. A land cell returns itself; a
 * water/edge cell returns the nearest cell with height ≥ LAND_H (by site
 * distance). The single home for the land rule both the marker and 3D-entry
 * halves share, so they stop naming different cells for a place.
 */
export function snapToLandCell(atlas: FmgAtlasResult, cellId: number): number {
  const cells = atlas.pack.cells;
  if (cellId >= 0 && (cells.h[cellId] ?? 0) >= LAND_H) return cellId;
  const site = cells.p[cellId];
  if (!site) return cellId;
  let best = cellId;
  let bestD = Infinity;
  for (let i = 0; i < cells.h.length; i++) {
    if ((cells.h[i] ?? 0) < LAND_H) continue;
    const p = cells.p[i];
    if (!p) continue;
    const d = (p[0] - site[0]) ** 2 + (p[1] - site[1]) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/**
 * Resolve the exact 3D-entry anchor for a clicked atlas cell (cell-native world).
 * The land-snapped clicked cell remains the location identity used by travel,
 * saves, the 2D marker, and the 3D worker. A burg's position is carried only as
 * a window-center override so the Locale still frames the town. FMG occasionally
 * places a burg coordinate across a Voronoi boundary from the cell that owns it;
 * treating that coordinate as a second cell id made the player occupy two places.
 */
export function entry3DAnchorForCell(atlas: FmgAtlasResult, cellId: number): Entry3DAnchor {
  // Resolve water or edge picks once. Every field in the returned anchor is now
  // interpreted relative to this one canonical land cell.
  const resolvedCellId = snapToLandCell(atlas, cellId);
  const burgId = (atlas.pack.cells as { burg?: ArrayLike<number> }).burg?.[resolvedCellId];
  if (burgId) {
    const burg = atlas.pack.burgs?.[burgId] as { x?: number; y?: number } | undefined;
    if (burg && burg.x != null && burg.y != null) {
      // The coordinate controls what the player sees on entry, not which atlas
      // polygon owns the player. This preserves town framing without redirecting
      // the 3D worker away from the cell selected and saved by the 2D game.
      return { cellId: resolvedCellId, centerPx: [burg.x, burg.y] };
    }
  }
  // Wilderness entry has no sub-cell visual target, so the worker centers on
  // the canonical cell's own site.
  return { cellId: resolvedCellId };
}

/**
 * Fan out points that resolve to the identical location so co-located markers
 * (e.g. several SP4 hidden places discovered in the same place, which all snap
 * to one Voronoi site) don't stack into one indistinguishable pin. Points
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
