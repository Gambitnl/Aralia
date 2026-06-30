import { describe, expect, it } from 'vitest';
import { appReducer } from '../appState';
import { GamePhase } from '../../types';
import { createMockGameState, createMockPlayerCharacter } from '../../utils/core/factories';

/**
 * Cell-native world (Stage 1): the transport that carries the EXACT entry anchor
 * (atlas cell + the burg's world position to center the Locale) from a map
 * click / start-selection through to World3DWrapper, so 3D entry anchors on the
 * chosen cell instead of a coarse-grid neighbour. Cleared on 3D exit.
 */
describe('entry3DAnchor transport', () => {
  it('defaults to null on a fresh state', () => {
    expect(createMockGameState().entry3DAnchor).toBeNull();
  });

  it('SET_ENTRY_3D_ANCHOR stores the cell id + center pixel', () => {
    const next = appReducer(createMockGameState(), {
      type: 'SET_ENTRY_3D_ANCHOR',
      payload: { cellId: 562, centerPx: [1234, 5678] },
    });
    expect(next.entry3DAnchor).toEqual({ cellId: 562, centerPx: [1234, 5678] });
  });

  it('CLEAR_ENTRY_3D_ANCHOR resets it to null', () => {
    const set = appReducer(createMockGameState(), {
      type: 'SET_ENTRY_3D_ANCHOR',
      payload: { cellId: 7 },
    });
    expect(appReducer(set, { type: 'CLEAR_ENTRY_3D_ANCHOR' }).entry3DAnchor).toBeNull();
  });

  // The start-selection spawn threads the anchor through START_GAME_SUCCESS so it
  // survives the reducer's `{ ...initialGameState }` rebuild (a separate dispatch
  // before startGame would be clobbered). This is the wiring the live spawn relies on.
  it('START_GAME_SUCCESS carries the entry3DAnchor from its payload', () => {
    const next = appReducer(createMockGameState({ phase: GamePhase.CHARACTER_CREATION }), {
      type: 'START_GAME_SUCCESS',
      payload: {
        character: createMockPlayerCharacter({ id: 'p1', name: 'Hero' }),
        dynamicLocationItemIds: {},
        initialLocationDescription: 'x',
        initialSubMapCoordinates: { x: 1, y: 1 },
        initialActiveDynamicNpcIds: null,
        startingInventory: [],
        entry3DAnchor: { cellId: 562, centerPx: [1286516, 1299213] },
      },
    });
    expect(next.phase).toBe(GamePhase.PLAYING);
    expect(next.entry3DAnchor).toEqual({ cellId: 562, centerPx: [1286516, 1299213] });
  });

  it('START_GAME_SUCCESS without an anchor leaves it null (dev/skip flows)', () => {
    const next = appReducer(createMockGameState({ phase: GamePhase.CHARACTER_CREATION }), {
      type: 'START_GAME_SUCCESS',
      payload: {
        character: createMockPlayerCharacter({ id: 'p1', name: 'Hero' }),
        dynamicLocationItemIds: {},
        initialLocationDescription: 'x',
        initialSubMapCoordinates: { x: 1, y: 1 },
        initialActiveDynamicNpcIds: null,
        startingInventory: [],
      },
    });
    expect(next.entry3DAnchor).toBeNull();
  });
});
