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

/**
 * Backfills `loadedState.playerCell` in place when absent. No-op when already
 * present (idempotent). Returns the same state for convenience.
 */
export function migratePlayerCell(loadedState: GameState): GameState {
  // Idempotence: a save that already carries the canonical cell is untouched.
  if (loadedState.playerCell) return loadedState;

  const tile = locationIdToTile(loadedState.currentLocationId, LOCATIONS);
  if (!tile) {
    loadedState.playerCell = null;
    return loadedState;
  }

  const gridSize = loadedState.mapData?.gridSize ?? MAP_GRID_SIZE;
  // Legacy save field (Stage 6 removed subMapCoordinates from GameState); read it
  // off the raw loaded save if an old save carries it, else null.
  const legacySubmap = (loadedState as unknown as { subMapCoordinates?: { x: number; y: number } | null }).subMapCoordinates ?? null;
  loadedState.playerCell = derivePlayerCellForTile(
    loadedState.worldSeed ?? 0,
    tile,
    legacySubmap,
    { cols: gridSize.cols, rows: gridSize.rows },
  );
  return loadedState;
}
