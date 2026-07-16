import { describe, expect, it } from 'vitest';
import { appReducer, initialGameState } from '../appState';
import { GamePhase } from '../../types';
import { createMockGameState } from '../../utils/core/factories';
import { createEmptyHistory } from '../../utils/historyUtils';

// ============================================================================
// World State Shape Defaults
// ============================================================================
// These tests protect the save/load boundary for world-owned fields that older
// saves may omit. Runtime systems can still treat rumors, history, encounter
// receipts, notifications, and merchant UI data as present after boot or load.
// ============================================================================

describe('appState world state shape defaults', () => {
  it('starts fresh games with concrete world-state collections', () => {
    expect(initialGameState.activeRumors).toEqual([]);
    expect(initialGameState.worldHistory).toEqual(createEmptyHistory());
    expect(initialGameState.notifications).toEqual([]);
    expect(initialGameState.worldforgeEncounterReceipts).toEqual([]);
    expect(initialGameState.merchantModal).toEqual({
      isOpen: false,
      merchantName: '',
      merchantInventory: [],
    });
  });

  it('repairs legacy loaded saves that omit optional world-state fields', () => {
    const legacyLoadedState = {
      ...createMockGameState({
        phase: GamePhase.PLAYING,
        activeRumors: undefined,
        worldHistory: undefined,
      }),
      notifications: undefined,
      merchantModal: undefined,
      // This predates generated-state patrol persistence. Loading it must not
      // make the 3D movement referee dereference a missing receipt list.
      worldforgeEncounterReceipts: undefined,
    };

    const result = appReducer(createMockGameState({ phase: GamePhase.MAIN_MENU }), {
      type: 'LOAD_GAME_SUCCESS',
      payload: legacyLoadedState as never,
    });

    expect(result.activeRumors).toEqual([]);
    expect(result.worldHistory).toEqual(createEmptyHistory());
    expect(result.notifications).toEqual([]);
    expect(result.worldforgeEncounterReceipts).toEqual([]);
    expect(result.merchantModal).toEqual({
      isOpen: false,
      merchantName: '',
      merchantInventory: [],
    });
  });
});
