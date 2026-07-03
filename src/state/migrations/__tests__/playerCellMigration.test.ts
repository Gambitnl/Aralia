import { describe, it, expect } from 'vitest';
import { migratePlayerCell } from '../playerCellMigration';
import { createMockGameState } from '../../../utils/core/factories';
import { makeCellLocationId } from '../../../utils/location/cellLocationId';
import { applyWfSpawnToMap } from '../../../systems/worldforge/local/resolveSpawn';
import { clearDebugLog, readDebugLog } from '../../../utils/debugLog';

/**
 * Cell-native world: saves carry `playerCell: { cellId, localeCoords }`. On load
 * the migration backfills it when absent. A `cell_<cellId>` id recovers the cell
 * directly. Auto-anchor (2026-07-02): any other unresolvable location (pre-cell
 * coord_X_Y saves, static-opening runs) anchors to the world's deterministic
 * start town instead of loading with a null cell — a null cell leaves Find Me,
 * "3D at My Location" and map travel dead with no in-game recovery path.
 */
describe('migratePlayerCell (cell-native)', () => {
  it('recovers the cell from a cell_<id> location id when playerCell is absent', () => {
    const state = createMockGameState({
      currentLocationId: makeCellLocationId(1880),
      playerCell: null,
    });
    migratePlayerCell(state);
    expect(state.playerCell).toEqual({ cellId: 1880, localeCoords: null });
  });

  it('is idempotent — a save that already has playerCell is left untouched', () => {
    const existing = { cellId: 999, localeCoords: { x: 1, y: 1 } };
    const state = createMockGameState({
      currentLocationId: makeCellLocationId(1880),
      playerCell: existing,
    });
    migratePlayerCell(state);
    expect(state.playerCell).toBe(existing);
  });

  it('auto-anchors an unresolvable location to the world start town (deterministic spawn cell)', () => {
    const state = createMockGameState({
      currentLocationId: 'coord_15_10',
      playerCell: null,
    });
    expect(() => migratePlayerCell(state)).not.toThrow();
    expect(state.playerCell).not.toBeNull();
    // The anchor must be the same cell a fresh world of this seed spawns at.
    const spawn = applyWfSpawnToMap(state.worldSeed!);
    expect(state.playerCell!.cellId).toBe(spawn.atlasCellId);
    expect(state.playerCell!.localeCoords).toBeNull();
  });

  it('records the auto-anchor rescue in the Dev Menu debug log', () => {
    clearDebugLog();
    const state = createMockGameState({
      currentLocationId: 'coord_15_10',
      playerCell: null,
    });
    migratePlayerCell(state);
    const entries = readDebugLog().filter((e) => e.category === 'auto-anchor');
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toMatch(/anchored to start/i);
    expect(entries[0].data?.cellId).toBe(state.playerCell!.cellId);
  });

  it('leaves playerCell null when the save has no world seed (nothing to anchor into)', () => {
    const state = createMockGameState({
      currentLocationId: 'coord_15_10',
      playerCell: null,
    });
    (state as { worldSeed?: number | null }).worldSeed = null;
    expect(() => migratePlayerCell(state)).not.toThrow();
    expect(state.playerCell).toBeNull();
  });
}, 60000);
