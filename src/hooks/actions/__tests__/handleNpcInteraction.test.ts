import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Dispatch } from 'react';
import { handleStartDialogue } from '../handleNpcInteraction';
import type { Action, GameState } from '../../../types';
import type { AppAction } from '../../../state/actionTypes';

// This test protects the new first-contact memory touchpoint only.
// It checks that meeting a new NPC now refreshes the interaction clock in
// the same branch that already writes the "met" fact and dialogue session.
const generatedNpc = {
  id: 'npc_1',
  name: 'Test NPC',
  biography: {
    age: 31,
    classId: 'villager',
  },
};

vi.mock('../../../constants', () => ({
  NPCS: {},
}));

vi.mock('../../../services/npcGenerator', () => ({
  generateNPC: vi.fn(() => generatedNpc),
}));

describe('handleStartDialogue', () => {
  const gameTime = new Date(Date.UTC(2026, 5, 9, 12, 0, 0));
  const mockDispatch = vi.fn<(action: AppAction) => void>();
  const mockAddMessage = vi.fn<(message: string, channel: string) => void>();

  const mockGameState = {
    gameTime,
    metNpcIds: [],
    generatedNpcs: {},
  } as unknown as GameState;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stamps interaction recency when first meeting a generated NPC', async () => {
    const action: Action = {
      type: 'talk',
      payload: { npcId: 'npc_1' },
    } as Action;

    await handleStartDialogue({
      action,
      gameState: mockGameState,
      dispatch: mockDispatch as unknown as Dispatch<AppAction>,
      addMessage: mockAddMessage,
    });

    const timestampCall = mockDispatch.mock.calls.find(([dispatched]) => dispatched.type === 'UPDATE_NPC_INTERACTION_TIMESTAMP');
    expect(timestampCall).toBeDefined();
    expect(timestampCall?.[0].payload).toEqual({
      npcId: 'npc_1',
      timestamp: gameTime.getTime(),
    });

    expect(mockDispatch.mock.calls.some(([dispatched]) => dispatched.type === 'ADD_NPC_KNOWN_FACT')).toBe(true);
    expect(mockDispatch.mock.calls.some(([dispatched]) => dispatched.type === 'ADD_MET_NPC')).toBe(true);
    expect(mockDispatch.mock.calls.some(([dispatched]) => dispatched.type === 'START_DIALOGUE_SESSION')).toBe(true);
  });
});
