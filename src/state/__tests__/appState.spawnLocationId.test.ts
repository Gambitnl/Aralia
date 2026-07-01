import { describe, expect, it } from 'vitest';
import { appReducer } from '../appState';
import { GamePhase } from '../../types';
import { STARTING_LOCATION_ID } from '../../data/world/locations';
import { createMockGameState, createMockPlayerCharacter } from '../../utils/core/factories';

/**
 * The WF-derived spawn relocates the player's world marker onto the chosen
 * town's tile, but the *logical* location used to be hardcoded to the generic
 * 'clearing' node — a geographic mismatch. START_GAME_SUCCESS now honors an
 * explicit `initialLocationId` (the spawn tile's coord_/named id) so the
 * logical location matches where the player actually stands.
 */
function startWith(initialLocationId?: string) {
  return appReducer(createMockGameState({ phase: GamePhase.CHARACTER_CREATION }), {
    type: 'START_GAME_SUCCESS',
    payload: {
      character: createMockPlayerCharacter({ id: 'player-1', name: 'Test Hero' }),
      dynamicLocationItemIds: {},
      initialLocationDescription: 'A quiet beginning.',
      initialActiveDynamicNpcIds: null,
      startingInventory: [],
      ...(initialLocationId ? { initialLocationId } : {}),
    },
  });
}

describe('START_GAME_SUCCESS spawn location id', () => {
  it('uses the provided spawn location id (the tile the player actually occupies)', () => {
    const result = startWith('coord_15_10');
    expect(result.phase).toBe(GamePhase.PLAYING);
    expect(result.currentLocationId).toBe('coord_15_10');
  });

  it('falls back to the legacy starting location when no spawn id is supplied', () => {
    const result = startWith();
    expect(result.currentLocationId).toBe(STARTING_LOCATION_ID);
  });
});
