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


// A paid Atlas journey changes the cell before the outgoing scene unmounts.
// Its last footfall must not revive the departed Local or alter the new feet.
describe('Atlas journey leaves its old ground behind', () => {
  const address = {
    schemaVersion: 1 as const, worldSeed: 42, atlasCellId: 7,
    regionSeedPath: '42/cell:7', regionBounds: {x: 0, y: 0, width: 25000, height: 25000},
    localSeedPath: '42/cell:7/local:1', localBounds: {x: 0, y: 0, width: 3000, height: 3000},
    focus: {kind: 'site' as const, id: 1, xFt: 100, yFt: 100}, returnTier: 'local' as const,
  };
  const oldPosition = {tileX: 7, tileY: 0, xM: 100, zM: 120, yM: 18};
  const oldState = () => createMockGameState({
    worldSeed: 42, currentLocationId: 'cell_7', playerCell: {cellId: 7, localeCoords: {x: 328, y: 394}},
    playerGroundPos: oldPosition, atlasGroundAddress: address, gold: 8.16,
    travelMinutesRemainder: 215.91328364325,
  });
  const journey = () => appReducer(oldState(), {type: 'MOVE_PLAYER', payload: {
    newLocationId: 'cell_562', activeDynamicNpcIds: null,
    destinationCell: {cellId: 562, anchor: {cellId: 562}},
  }});

  it('clears the departed Local address as well as its meters on a committed journey', () => {
    const arrived = journey();
    expect(arrived.atlasGroundAddress).toBeNull();
    expect(arrived.atlasGroundPosition).toBeNull();
    expect(arrived.playerGroundPos).toBeNull();
    expect(arrived.playerCell).toEqual({cellId: 562, localeCoords: null});
    expect(arrived.gold).toBe(8.16);
    expect(arrived.travelMinutesRemainder).toBe(oldState().travelMinutesRemainder);
  });

  it('ignores a delayed outgoing ground report after the destination commits', () => {
    const arrived = journey();
    const afterLateFrame = appReducer(arrived, {type: 'SET_PLAYER_GROUND_POS', payload: {position: oldPosition}});
    expect(afterLateFrame.playerGroundPos).toBeNull();
    expect(afterLateFrame.playerCell).toEqual(arrived.playerCell);
  });

  it('still accepts a reached body report from the destination cell', () => {
    const reached = {tileX: 562, tileY: 0, xM: 80, zM: 140, yM: 12};
    const next = appReducer(journey(), {type: 'SET_PLAYER_GROUND_POS', payload: {position: reached}});
    expect(next.playerGroundPos).toEqual(reached);
    expect(next.playerCell?.cellId).toBe(562);
    expect(next.playerCell?.localeCoords?.x).toBeCloseTo(80 / .3048, 10);
    expect(next.playerCell?.localeCoords?.y).toBeCloseTo(140 / .3048, 10);
  });

  it('loads an already-earned destination without resurrecting its foreign old Local', () => {
    const saved = {...oldState(), currentLocationId: 'cell_562', playerCell: {cellId: 562, localeCoords: {x: 328, y: 394}}, entry3DAnchor: {cellId: 562}};
    const loaded = appReducer(createMockGameState(), {type: 'LOAD_GAME_SUCCESS', payload: saved});
    expect(loaded.atlasGroundAddress).toBeNull();
    expect(loaded.atlasGroundPosition).toBeNull();
    expect(loaded.playerGroundPos).toBeNull();
    expect(loaded.playerCell).toEqual({cellId: 562, localeCoords: null});
    expect(loaded.currentLocationId).toBe('cell_562');
    expect(loaded.entry3DAnchor).toEqual(saved.entry3DAnchor);
    for(const key of ['gold', 'inventory', 'party', 'worldBusinesses', 'npcMemory', 'questLog', 'travelMinutesRemainder'] as const) expect(loaded[key]).toEqual(saved[key]);
    expect(loaded.gameTime).toEqual(saved.gameTime);
  });

  it('preserves a same-cell saved Local and its accepted feet', () => {
    const saved = oldState();
    const loaded = appReducer(createMockGameState(), {type: 'LOAD_GAME_SUCCESS', payload: saved});
    expect(loaded.atlasGroundAddress).toEqual(saved.atlasGroundAddress);
    expect(loaded.playerGroundPos).toEqual(saved.playerGroundPos);
    expect(loaded.playerCell).toEqual(saved.playerCell);
  });
});
