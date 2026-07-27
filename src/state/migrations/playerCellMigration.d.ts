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
export declare function migratePlayerCell(loadedState: GameState): GameState;
