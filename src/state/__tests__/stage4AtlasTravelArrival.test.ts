import { describe, it, expect } from 'vitest';
import { appReducer } from '../appState';
import { createMockGameState } from '../../utils/core/factories';
import { deriveCellIdFromTile } from '../../systems/worldforge/local/playerCellFromLegacy';
import type { Entry3DAnchor } from '../../types/state';

/**
 * Stage 4 (cell-native world): atlas fast-travel as the world loop. A Travel-mode
 * pick carries the EXACT destination cell + its 3D-entry anchor through the trip
 * commit (`MOVE_PLAYER.payload.destinationCell`). On arrival the reducer:
 *  - sets `playerCell.cellId` to that EXACT cell (NOT the lossy tile reverse-derive),
 *  - RESETS `localeCoords` to null (the old Locale's feet are meaningless here),
 *  - stamps `entry3DAnchor` so a later Enter-3D frames the destination town.
 * A move WITHOUT `destinationCell` (legacy compass/static) is byte-identical to today.
 */
describe('Stage 4 — MOVE_PLAYER cell-native arrival', () => {
  const SEED = 42;
  const COLS = 30;
  const ROWS = 20;

  const anchor: Entry3DAnchor = { cellId: 562, centerPx: [123, 456] };

  it('lands the EXACT destination cell, resets Locale feet, and stamps the entry anchor', () => {
    // Start with a non-null playerCell carrying STALE feet from a prior Locale.
    const base = createMockGameState({
      worldSeed: SEED,
      playerCell: { cellId: 7, localeCoords: { x: 999, y: 888 } },
    });

    const next = appReducer(base, {
      type: 'MOVE_PLAYER',
      payload: {
        // Lossy bookkeeping tile (coord_X_Y) — its reverse-derived cell is NOT 562.
        newLocationId: 'coord_15_10',
        newSubMapCoordinates: { x: 5, y: 5 },
        mapData: base.mapData ?? undefined,
        activeDynamicNpcIds: null,
        destinationCell: { cellId: 562, anchor },
      },
    });

    // The destination cell is carried INTACT — not the reverse-derive of the tile.
    const tileDerived = deriveCellIdFromTile(SEED, 15, 10, COLS, ROWS);
    expect(next.playerCell).toEqual({ cellId: 562, localeCoords: null });
    expect(562).not.toBe(tileDerived); // proves we did not reverse-derive from the tile

    // Stale feet are GONE (Stage-4 critical requirement).
    expect(next.playerCell!.localeCoords).toBeNull();

    // Arrival sets up entry into the destination town/cell.
    expect(next.entry3DAnchor).toEqual(anchor);

    // Legacy bookkeeping untouched (additive guarantee).
    expect(next.currentLocationId).toBe('coord_15_10');
    expect(next.subMapCoordinates).toEqual({ x: 5, y: 5 });
  });

  it('without destinationCell is unchanged: Stage-2 tile-derived cell + null entry anchor', () => {
    const base = createMockGameState({ worldSeed: SEED });
    const next = appReducer(base, {
      type: 'MOVE_PLAYER',
      payload: {
        newLocationId: 'coord_15_10',
        newSubMapCoordinates: { x: 4, y: 7 },
        mapData: base.mapData ?? undefined,
        activeDynamicNpcIds: null,
      },
    });

    const expectedCell = deriveCellIdFromTile(SEED, 15, 10, COLS, ROWS);
    expect(next.playerCell).not.toBeNull();
    expect(next.playerCell!.cellId).toBe(expectedCell);
    expect(next.playerCell!.localeCoords).toEqual({ x: 4, y: 7 });
    expect(next.entry3DAnchor).toBeNull();
    expect(next.currentLocationId).toBe('coord_15_10');
  });
}, 30000);
