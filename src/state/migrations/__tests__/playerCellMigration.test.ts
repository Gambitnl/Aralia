import { describe, it, expect } from 'vitest';
import { migratePlayerCell } from '../playerCellMigration';
import { createMockGameState } from '../../../utils/core/factories';
import { makeCellLocationId } from '../../../utils/location/cellLocationId';

/**
 * Cell-native world: saves carry `playerCell: { cellId, localeCoords }`. On load
 * the migration backfills it when absent. Grid retirement (2026-07-01): the 30×20
 * grid is gone, so a pre-cell `coord_X_Y` save can no longer reverse-map to a cell
 * (the legacy tile→cell bridge is deleted) — it loads with a null cell. A
 * `cell_<cellId>` id recovers the cell directly.
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

  it('leaves playerCell null for a pre-cell coord_X_Y save (grid retired — no reverse-map)', () => {
    const state = createMockGameState({
      currentLocationId: 'coord_15_10',
      playerCell: null,
    });
    expect(() => migratePlayerCell(state)).not.toThrow();
    expect(state.playerCell).toBeNull();
  });
}, 30000);
