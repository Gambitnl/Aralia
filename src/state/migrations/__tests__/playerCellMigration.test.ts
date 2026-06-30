import { describe, it, expect } from 'vitest';
import { migratePlayerCell } from '../playerCellMigration';
import { createMockGameState } from '../../../utils/core/factories';
import { deriveCellIdFromTile } from '../../../systems/worldforge/local/playerCellFromLegacy';

/**
 * Stage 2 (cell-native world): pre-Stage-2 saves carry `currentLocationId`
 * (coord_X_Y) + `subMapCoordinates` but no `playerCell`. On load, the canonical
 * cell is BACKFILLED from the legacy fields via the existing golden reverse
 * mapping — versioned + idempotent, mirroring worldDataMigration.
 */
describe('migratePlayerCell', () => {
  const SEED = 42;
  const COLS = 30;
  const ROWS = 20;

  it('backfills playerCell from coord_X_Y + subMapCoordinates on an old save', () => {
    const state = createMockGameState({
      worldSeed: SEED,
      currentLocationId: 'coord_15_10',
      subMapCoordinates: { x: 3, y: 6 },
      playerCell: null,
    });
    // mapData.gridSize drives the grid dims; the mock factory provides a real grid.
    migratePlayerCell(state);
    const expectedCell = deriveCellIdFromTile(SEED, 15, 10, state.mapData?.gridSize.cols ?? COLS, state.mapData?.gridSize.rows ?? ROWS);
    expect(state.playerCell).not.toBeNull();
    expect(state.playerCell!.cellId).toBe(expectedCell);
    expect(state.playerCell!.localeCoords).toEqual({ x: 3, y: 6 });
  });

  it('is idempotent — a save that already has playerCell is left untouched', () => {
    const existing = { cellId: 999, localeCoords: { x: 1, y: 1 } };
    const state = createMockGameState({
      worldSeed: SEED,
      currentLocationId: 'coord_15_10',
      subMapCoordinates: { x: 3, y: 6 },
      playerCell: existing,
    });
    migratePlayerCell(state);
    expect(state.playerCell).toBe(existing);
  });

  it('leaves playerCell null (and does not throw) when the location has no world tile', () => {
    const state = createMockGameState({
      worldSeed: SEED,
      // An id that is neither coord_X_Y nor a static LOCATIONS entry with coords.
      currentLocationId: 'unknown_nonexistent_place',
      subMapCoordinates: { x: 0, y: 0 },
      playerCell: null,
    });
    expect(() => migratePlayerCell(state)).not.toThrow();
    expect(state.playerCell).toBeNull();
  });
}, 30000);
