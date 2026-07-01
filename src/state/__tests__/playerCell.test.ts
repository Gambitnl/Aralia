import { describe, it, expect } from 'vitest';
import { appReducer } from '../appState';
import { initialGameState } from '../initialState';
import { GamePhase } from '../../types';
import { createMockGameState, createMockPlayerCharacter } from '../../utils/core/factories';
import { makeCellLocationId } from '../../utils/location/cellLocationId';

/**
 * Cell-native world: the canonical player presence `playerCell: { cellId,
 * localeCoords }` is the SOURCE OF TRUTH, recorded wherever the location is set.
 * Grid retirement (2026-07-01): the location id is a `cell_<cellId>` string — the
 * cell IS the id (no 30×20 grid reverse-map). A non-cell id resolves to null.
 */
describe('playerCell canonical position model', () => {
  const SEED = 42;
  const CELL = 1880;

  it('defaults to null on a fresh factory + initial state', () => {
    expect(createMockGameState().playerCell).toBeNull();
    expect(initialGameState.playerCell).toBeNull();
  });

  it('MOVE_PLAYER (no destinationCell) reads the cell straight from the cell_<id>; localeCoords null', () => {
    const base = createMockGameState({ worldSeed: SEED });
    const locId = makeCellLocationId(CELL);
    const next = appReducer(base, {
      type: 'MOVE_PLAYER',
      payload: {
        newLocationId: locId,
        activeDynamicNpcIds: null,
      },
    });

    expect(next.currentLocationId).toBe(locId);
    expect(next.playerCell).not.toBeNull();
    expect(next.playerCell!.cellId).toBe(CELL);
    // No subMapCoordinates; Locale feet come from a ground session, so null here.
    expect(next.playerCell!.localeCoords).toBeNull();
  });

  it('MOVE_PLAYER to a legacy coord_X_Y id yields a null cell (grid retired — no reverse-map)', () => {
    const next = appReducer(createMockGameState({ worldSeed: SEED }), {
      type: 'MOVE_PLAYER',
      payload: { newLocationId: 'coord_15_10', activeDynamicNpcIds: null },
    });
    expect(next.playerCell).toBeNull();
  });

  it('START_GAME_SUCCESS threads an explicit playerCell from its payload', () => {
    const next = appReducer(createMockGameState({ phase: GamePhase.CHARACTER_CREATION }), {
      type: 'START_GAME_SUCCESS',
      payload: {
        character: createMockPlayerCharacter({ id: 'p1', name: 'Hero' }),
        dynamicLocationItemIds: {},
        initialLocationDescription: 'x',
        initialLocationId: makeCellLocationId(562),
        initialActiveDynamicNpcIds: null,
        startingInventory: [],
        worldSeed: SEED,
        entry3DAnchor: { cellId: 562, centerPx: [100, 200] },
        playerCell: { cellId: 562, localeCoords: { x: 1, y: 1 } },
      },
    });
    expect(next.phase).toBe(GamePhase.PLAYING);
    // Source of truth + 3D anchor agree from frame one.
    expect(next.playerCell).toEqual({ cellId: 562, localeCoords: { x: 1, y: 1 } });
    expect(next.entry3DAnchor!.cellId).toBe(562);
  });

  it('START_GAME_SUCCESS without a payload cell reads it from the cell_<id> spawn id', () => {
    const next = appReducer(createMockGameState({ phase: GamePhase.CHARACTER_CREATION }), {
      type: 'START_GAME_SUCCESS',
      payload: {
        character: createMockPlayerCharacter({ id: 'p1', name: 'Hero' }),
        dynamicLocationItemIds: {},
        initialLocationDescription: 'x',
        initialLocationId: makeCellLocationId(CELL),
        initialActiveDynamicNpcIds: null,
        startingInventory: [],
        worldSeed: SEED,
      },
    });
    expect(next.playerCell).not.toBeNull();
    expect(next.playerCell!.cellId).toBe(CELL);
    expect(next.playerCell!.localeCoords).toBeNull();
  });
}, 30000);
