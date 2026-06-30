/**
 * @file playerCellFromLegacy.ts — derive the canonical player CELL from a legacy
 * grid tile (cell-native world, Stage 2).
 *
 * Stage 2 introduces `playerCell: { cellId, localeCoords }` as the source of
 * truth, with `currentLocationId` (coord_X_Y) + `subMapCoordinates` demoted to
 * derived shadows. Wherever the legacy position is set, we record the cell by
 * mapping the tile through the EXISTING golden reverse mapping
 * (`legacyTileToAtlasCell` — the same one `getWorldforgeLocalForLocation` uses,
 * NOT a reimplementation), so the recorded cell agrees with the cell the 3D
 * generator anchors on for that tile.
 *
 * Returns `null` on any failure (degenerate grid, no land cells, generator
 * hiccup) so a reducer or save-migration never throws. Null is an honest
 * "unknown cell" — the game still runs on the untouched legacy grid; this is NOT
 * a behavioural fallback path.
 */
import { getBridgeAtlas, legacyTileToAtlasCell } from '../bridge/legacySubmapBridge';
import type { PlayerCell } from '../../../types/state';

/**
 * Map a legacy grid tile (x, y) on a `cols × rows` world map to the atlas cell
 * the player occupies. Pure aside from the module-level atlas cache in the
 * bridge. Returns null if the cell can't be resolved.
 */
export function deriveCellIdFromTile(
  worldSeed: number,
  x: number,
  y: number,
  cols: number,
  rows: number,
): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || cols < 1 || rows < 1) return null;
  try {
    const atlas = getBridgeAtlas(worldSeed);
    const cellId = legacyTileToAtlasCell(atlas, x, y, cols, rows);
    return cellId >= 0 ? cellId : null;
  } catch {
    return null;
  }
}

/**
 * Build the canonical `PlayerCell` for a legacy world-map tile + Locale-local
 * position. Returns null when the cell can't be derived (the caller stores null
 * — honest "unknown cell", game still runs on the grid). `localeCoords` is taken
 * verbatim (Stage 2 = the submap sub-tile, mirroring `subMapCoordinates`).
 */
export function derivePlayerCellForTile(
  worldSeed: number,
  tile: { x: number; y: number },
  localeCoords: { x: number; y: number } | null,
  gridSize: { cols: number; rows: number },
): PlayerCell | null {
  const cellId = deriveCellIdFromTile(worldSeed, tile.x, tile.y, gridSize.cols, gridSize.rows);
  if (cellId === null) return null;
  return { cellId, localeCoords };
}
