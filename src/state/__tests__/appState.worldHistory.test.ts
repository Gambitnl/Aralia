import { describe, expect, it } from 'vitest';
import { appReducer } from '../appState';
import { GamePhase } from '../../types';
import { createMockGameState, createMockPlayerCharacter } from '../../utils/core/factories';

// These tests cover the reducer boundary rather than the hook itself. The
// hook now supplies worldHistory, so the reducer needs to keep that payload
// intact and fall back safely when older callers do not.
describe('appState world history bootstrap', () => {
  it('keeps first-build history on standard game start', () => {
    const worldHistory = { events: [{ id: 'hist-1', timestamp: 1, realtime: 1, type: 'DISCOVERY', title: 'Born', description: 'World birth', participants: [], importance: 10, tags: ['world_birth'] }] };
    const result = appReducer(createMockGameState({ phase: GamePhase.CHARACTER_CREATION }), {
      type: 'START_GAME_SUCCESS',
      payload: {
        character: createMockPlayerCharacter({ id: 'player-1', name: 'Test Hero' }),
        mapData: {} as never,
        dynamicLocationItemIds: {},
        initialLocationDescription: 'A quiet beginning.',
        initialSubMapCoordinates: { x: 1, y: 2 },
        initialActiveDynamicNpcIds: null,
        startingInventory: [],
        worldHistory,
      },
    });

    expect(result.phase).toBe(GamePhase.PLAYING);
    expect(result.worldHistory).toBe(worldHistory);
  });

  it('keeps first-build history on dummy bootstrap', () => {
    const worldHistory = { events: [] };
    const result = appReducer(createMockGameState({ phase: GamePhase.MAIN_MENU }), {
      type: 'START_GAME_FOR_DUMMY',
      payload: {
        mapData: {} as never,
        dynamicLocationItemIds: {},
        generatedParty: [createMockPlayerCharacter({ id: 'player-1', name: 'Test Hero' })],
        worldSeed: 1234,
        initialInventory: [],
        worldHistory,
      },
    });

    expect(result.phase).toBe(GamePhase.PLAYING);
    expect(result.worldHistory).toBe(worldHistory);
  });
});
