/**
 * @file playerCellMigration.ts
 * @description One-shot loader-side migration: backfills the canonical
 * `playerCell` (cell-native world, Stage 2) on saves created before it existed.
 * Idempotent — safe to call on already-migrated saves (no-op when present).
 *
 * Why this is built this way:
 * - Stage 2 makes `playerCell: { cellId, localeCoords }` the source of truth for
 *   the player's position; `currentLocationId` (coord_X_Y) + `subMapCoordinates`
 *   become derived shadows. Pre-Stage-2 saves only carry the legacy fields, so on
 *   load we derive the cell from them via the EXISTING golden reverse mapping
 *   (`legacyTileToAtlasCell`, the same one the 3D generator uses) — never a new or
 *   reimplemented mapping.
 * - Mirrors the `migrateMapDataToWorldDataV2` pattern (idempotent, called from
 *   saveLoadService.loadGame after the other backfills).
 *
 * On any failure (unresolvable location, no land cells, generator hiccup) the
 * cell stays null — an honest "unknown cell". The save still loads and plays on
 * the untouched legacy grid; this is NOT a behavioural fallback path.
 */
import type { GameState } from '../../types';
import { LOCATIONS } from '../../data/world/locations';
import { MAP_GRID_SIZE } from '../../config/mapConfig';
import { locationIdToTile } from '../../utils/locationUtils';
import { derivePlayerCellForTile } from '../../systems/worldforge/local/playerCellFromLegacy';
import { makeCellLocationId } from '../../utils/location/cellLocationId';

/**
 * Backfills `loadedState.playerCell` in place when absent. No-op when already
 * present (idempotent). Returns the same state for convenience.
 */
export function migratePlayerCell(loadedState: GameState): GameState {
  // Backfill the canonical cell on pre-Stage-2 saves (those without playerCell).
  if (!loadedState.playerCell) {
    const tile = locationIdToTile(loadedState.currentLocationId, LOCATIONS);
    if (tile) {
      // Grid retirement: saves carry no mapData grid; the cell reverse-map uses the
      // canonical MAP_GRID_SIZE bookkeeping dims. subMapCoordinates is read off the
      // raw old save if present (the field was removed from GameState).
      const legacySubmap = (loadedState as unknown as { subMapCoordinates?: { x: number; y: number } | null }).subMapCoordinates ?? null;
      loadedState.playerCell = derivePlayerCellForTile(
        loadedState.worldSeed ?? 0,
        tile,
        legacySubmap,
        { cols: MAP_GRID_SIZE.cols, rows: MAP_GRID_SIZE.rows },
      );
    } else {
      loadedState.playerCell = null;
    }
  }

  // Grid retirement: rewrite a legacy `coord_X_Y` currentLocationId to the
  // cell-native `cell_<cellId>` form, so the loaded game holds no coord_ ids.
  if (loadedState.currentLocationId?.startsWith('coord_') && loadedState.playerCell?.cellId != null) {
    loadedState.currentLocationId = makeCellLocationId(loadedState.playerCell.cellId);
  }
  return loadedState;
}
