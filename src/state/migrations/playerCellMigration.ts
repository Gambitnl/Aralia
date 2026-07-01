/**
 * @file playerCellMigration.ts
 * @description One-shot loader-side migration: backfills the canonical
 * `playerCell` (cell-native world, Stage 2) on saves created before it existed.
 * Idempotent — safe to call on already-migrated saves (no-op when present).
 *
 * Why this is built this way:
 * - Stage 2 makes `playerCell: { cellId, localeCoords }` the source of truth for
 *   the player's position; `currentLocationId` (coord_X_Y) becomes the derived
 *   legacy shadow. Pre-Stage-2 saves only carry the legacy field, so on load we
 *   derive the cell from it (a `cell_<id>` id recovers it directly) — never a new
 *   or reimplemented mapping. (The old `subMapCoordinates` shadow was removed in
 *   grid-retirement slice 4a; nothing reads it off the raw save.)
 * - Mirrors the `migrateMapDataToWorldDataV2` pattern (idempotent, called from
 *   saveLoadService.loadGame after the other backfills).
 *
 * On any failure (unresolvable location, no land cells, generator hiccup) the
 * cell stays null — an honest "unknown cell". The save still loads and plays on
 * the untouched legacy grid; this is NOT a behavioural fallback path.
 */
import type { GameState } from '../../types';
import { parseCellLocationId } from '../../utils/location/cellLocationId';

/**
 * Backfills `loadedState.playerCell` in place when absent. No-op when already
 * present (idempotent). Returns the same state for convenience.
 *
 * Grid retirement (2026-07-01): the 30×20 grid is gone, so a pre-cell `coord_X_Y`
 * save can no longer reverse-map to a cell (the legacy tile→cell bridge is
 * deleted). Cell-native saves carry `playerCell`; a `cell_<cellId>` id recovers it
 * directly; anything else loads with a null cell (an honest "unknown cell" — the
 * game still loads and plays).
 */
export function migratePlayerCell(loadedState: GameState): GameState {
  if (loadedState.playerCell) return loadedState;
  const directCell = parseCellLocationId(loadedState.currentLocationId);
  loadedState.playerCell = directCell != null ? { cellId: directCell, localeCoords: null } : null;
  return loadedState;
}
