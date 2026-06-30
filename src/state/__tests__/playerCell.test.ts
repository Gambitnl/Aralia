import { describe, it, expect } from 'vitest';
import { appReducer } from '../appState';
import { initialGameState } from '../initialState';
import { GamePhase } from '../../types';
import { createMockGameState, createMockPlayerCharacter } from '../../utils/core/factories';
import { deriveCellIdFromTile } from '../../systems/worldforge/local/playerCellFromLegacy';

/**
 * Stage 2 (cell-native world): the canonical player presence
 * `playerCell: { cellId, localeCoords }` is the SOURCE OF TRUTH. It is RECORDED
 * wherever the legacy position is set; `currentLocationId` (coord_X_Y) +
 * `subMapCoordinates` remain the derived shadows that every existing reader keeps
 * using (this stage does not flip any readers).
 */
describe('playerCell canonical position model', () => {
  const SEED = 42;
  const COLS = 30;
  const ROWS = 20;

  it('defaults to null on a fresh factory + initial state', () => {
    expect(createMockGameState().playerCell).toBeNull();
    expect(initialGameState.playerCell).toBeNull();
  });

  it('MOVE_PLAYER records the cell derived from a coord_X_Y tile + keeps legacy fields intact', () => {
    const base = createMockGameState({ worldSeed: SEED });
    const newSubMapCoordinates = { x: 4, y: 7 };
    const next = appReducer(base, {
      type: 'MOVE_PLAYER',
      payload: {
        newLocationId: 'coord_15_10',
        newSubMapCoordinates,
        mapData: base.mapData ?? undefined,
        activeDynamicNpcIds: null,
      },
    });

    // Legacy fields unchanged (compat regression guard).
    expect(next.currentLocationId).toBe('coord_15_10');
    expect(next.subMapCoordinates).toEqual(newSubMapCoordinates);

    // Canonical cell recorded as the golden derive of that tile.
    const expectedCell = deriveCellIdFromTile(SEED, 15, 10, COLS, ROWS);
    expect(next.playerCell).not.toBeNull();
    expect(next.playerCell!.cellId).toBe(expectedCell);
    expect(next.playerCell!.localeCoords).toEqual(newSubMapCoordinates);
  });

  it('START_GAME_SUCCESS threads an explicit playerCell from its payload', () => {
    const next = appReducer(createMockGameState({ phase: GamePhase.CHARACTER_CREATION }), {
      type: 'START_GAME_SUCCESS',
      payload: {
        character: createMockPlayerCharacter({ id: 'p1', name: 'Hero' }),
        mapData: {} as never,
        dynamicLocationItemIds: {},
        initialLocationDescription: 'x',
        initialLocationId: 'coord_3_4',
        initialSubMapCoordinates: { x: 1, y: 1 },
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

  it('START_GAME_SUCCESS without a payload cell derives it from the spawn tile', () => {
    const next = appReducer(createMockGameState({ phase: GamePhase.CHARACTER_CREATION }), {
      type: 'START_GAME_SUCCESS',
      payload: {
        character: createMockPlayerCharacter({ id: 'p1', name: 'Hero' }),
        mapData: {} as never,
        dynamicLocationItemIds: {},
        initialLocationDescription: 'x',
        initialLocationId: 'coord_15_10',
        initialSubMapCoordinates: { x: 2, y: 2 },
        initialActiveDynamicNpcIds: null,
        startingInventory: [],
        worldSeed: SEED,
      },
    });
    const expectedCell = deriveCellIdFromTile(SEED, 15, 10, COLS, ROWS);
    expect(next.playerCell).not.toBeNull();
    expect(next.playerCell!.cellId).toBe(expectedCell);
    expect(next.playerCell!.localeCoords).toEqual({ x: 2, y: 2 });
  });
}, 30000);
