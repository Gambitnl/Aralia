import { describe, it, expect } from 'vitest';
import { appReducer } from '../appState';
import { createMockGameState } from '../../utils/core/factories';
import { makeCellLocationId } from '../../utils/location/cellLocationId';
import type { Entry3DAnchor } from '../../types/state';

/**
 * Atlas fast-travel as the world loop. A Travel-mode pick carries the EXACT
 * destination cell + its 3D-entry anchor through the trip commit
 * (`MOVE_PLAYER.payload.destinationCell`). On arrival the reducer:
 *  - sets `playerCell.cellId` to that EXACT cell,
 *  - RESETS `localeCoords` to null (the old Locale's feet are meaningless here),
 *  - stamps `entry3DAnchor` so a later Enter-3D frames the destination town.
 * A move WITHOUT `destinationCell` reads the cell straight from the `cell_<id>`
 * location id (grid retirement: there is no 30×20 tile to reverse-derive).
 */
describe('MOVE_PLAYER cell-native arrival', () => {
  const SEED = 42;
  const anchor: Entry3DAnchor = { cellId: 562, centerPx: [123, 456] };

  it('lands the EXACT destination cell, resets Locale feet, and stamps the entry anchor', () => {
    // Start with a non-null playerCell carrying STALE feet from a prior Locale.
    const base = createMockGameState({
      worldSeed: SEED,
      playerCell: { cellId: 7, localeCoords: { x: 999, y: 888 } },
      playerGroundPos: { tileX: 7, tileY: 0, xM: 999, zM: 888 },
    });

    const next = appReducer(base, {
      type: 'MOVE_PLAYER',
      payload: {
        newLocationId: makeCellLocationId(562),
        activeDynamicNpcIds: null,
        destinationCell: { cellId: 562, anchor },
      },
    });

    // The destination cell is carried INTACT, with the stale feet reset.
    expect(next.playerCell).toEqual({ cellId: 562, localeCoords: null });
    expect(next.playerGroundPos).toBeNull();
    // Arrival sets up entry into the destination town/cell.
    expect(next.entry3DAnchor).toEqual(anchor);
    expect(next.currentLocationId).toBe(makeCellLocationId(562));
  });

  it('without destinationCell reads the cell from the cell_<id> location id', () => {
    const base = createMockGameState({ worldSeed: SEED });
    const locId = makeCellLocationId(1880);
    const next = appReducer(base, {
      type: 'MOVE_PLAYER',
      payload: {
        newLocationId: locId,
        activeDynamicNpcIds: null,
      },
    });

    expect(next.playerCell).not.toBeNull();
    expect(next.playerCell!.cellId).toBe(1880);
    expect(next.playerCell!.localeCoords).toBeNull();
    expect(next.entry3DAnchor).toBeNull();
    expect(next.currentLocationId).toBe(locId);
  });
}, 30000);
