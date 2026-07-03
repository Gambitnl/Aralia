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
 *   derive the cell from it (a `cell_<id>` id recovers it directly).
 * - Auto-anchor (2026-07-02, explicit design decision): a save whose location
 *   can't be resolved to a cell (pre-migration coord_X_Y ids, static-opening
 *   runs) is anchored to its world's deterministic start town instead of
 *   loading with a null cell. A null cell leaves Find Me, "3D at My Location"
 *   AND map travel dead — with the grid bridge deleted there is no in-game way
 *   back except a 3D entry, so an unanchored run is effectively map-stranded.
 *   The anchor is the same capital-burg spawn a fresh world resolves
 *   (`applyWfSpawnToMap`), so it is deterministic and always a land cell.
 * - Mirrors the `migrateMapDataToWorldDataV2` pattern (idempotent, called from
 *   saveLoadService.loadGame after the other backfills).
 *
 * Only when the world seed itself is missing (no world to anchor into) does the
 * cell stay null — the save still loads and plays.
 */
import type { GameState } from '../../types';
import { parseCellLocationId } from '../../utils/location/cellLocationId';
import { applyWfSpawnToMap } from '../../systems/worldforge/local/resolveSpawn';
import { logger } from '../../utils/logger';
import { appendDebugLog } from '../../utils/debugLog';

/**
 * Backfills `loadedState.playerCell` in place when absent. No-op when already
 * present (idempotent). Returns the same state for convenience.
 *
 * Resolution order:
 * 1. `cell_<cellId>` location id → that exact cell (lossless recovery).
 * 2. Anything else with a known world seed → the world's start-town cell
 *    (deterministic auto-anchor; logged so the rescue is visible).
 * 3. No world seed → null (honest unknown; nothing to anchor into).
 */
export function migratePlayerCell(loadedState: GameState): GameState {
  if (loadedState.playerCell) return loadedState;
  const directCell = parseCellLocationId(loadedState.currentLocationId);
  if (directCell != null) {
    loadedState.playerCell = { cellId: directCell, localeCoords: null };
    return loadedState;
  }
  if (loadedState.worldSeed == null) {
    loadedState.playerCell = null;
    return loadedState;
  }
  try {
    const spawn = applyWfSpawnToMap(loadedState.worldSeed);
    loadedState.playerCell = { cellId: spawn.atlasCellId, localeCoords: null };
    logger.info('Auto-anchored save with unknown map position to the world start town', {
      cellId: spawn.atlasCellId,
      burgName: spawn.burgName ?? null,
      locationId: loadedState.currentLocationId,
    });
    // Dev Menu Debug Log: this rescue silently moves the player's map position —
    // leave a visible trace of when it happened and where they were anchored.
    appendDebugLog(
      'auto-anchor',
      spawn.burgName
        ? `Save had no map position — anchored to start town "${spawn.burgName}" (cell ${spawn.atlasCellId})`
        : `Save had no map position — anchored to start cell ${spawn.atlasCellId}`,
      { cellId: spawn.atlasCellId, locationId: loadedState.currentLocationId },
    );
  } catch (error) {
    // World generation failed — load with an honest unknown rather than crash.
    logger.error('Auto-anchor failed; save loads with unknown map position', { error });
    loadedState.playerCell = null;
  }
  return loadedState;
}
