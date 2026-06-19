import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Dispatch } from 'react';
import { handleStartDialogue, handleTalk } from '../handleNpcInteraction';
import type { Action, GameState } from '../../../types';
import type { AppAction } from '../../../state/actionTypes';

/**
 * This file protects NPC interaction behavior at the action-handler boundary.
 *
 * The tests keep generated-NPC first contact, normal static-NPC dialogue, and
 * quest-offer dialogue handoff separate so future agents can change one path
 * without accidentally changing the others.
 *
 * Called by: Vitest focused action-handler runs.
 * Depends on: handleNpcInteraction.ts and the existing quest blueprint registry.
 */

// ============================================================================
// Test Doubles
// ============================================================================
// This section replaces AI, voice, entity-linking, and NPC-generation services
// with tiny deterministic stand-ins. The handler can then be tested for the
// dispatches it owns without making network/model/audio calls.
// ============================================================================
const generatedNpc = {
  id: 'npc_1',
  name: 'Test NPC',
  biography: {
    age: 31,
    classId: 'villager',
  },
};

vi.mock('../../../constants', () => ({
  NPCS: {
    villager_generic: {
      id: 'villager_generic',
      name: 'Villager',
      role: 'civilian',
      initialPersonalityPrompt: 'A friendly town resident.',
      dialoguePromptSeed: 'The villager nods.',
      voice: { name: 'Aoede' },
    },
  },
}));

vi.mock('../../../services/npcGenerator', () => ({
  generateNPC: vi.fn(() => generatedNpc),
}));

vi.mock('../../../services/ollamaTextService', () => ({
  generateNPCResponse: vi.fn(async () => ({
    data: {
      text: 'I could use help gathering rare reagents.',
      promptSent: 'prompt',
      rawResponse: 'response',
    },
  })),
}));

vi.mock('../../../services/ttsService', () => ({
  synthesizeSpeech: vi.fn(async () => ({ audioData: null })),
}));

vi.mock('../../../utils/entityIntegrationUtils', () => ({
  resolveAndRegisterEntities: vi.fn(async () => undefined),
}));

// ============================================================================
// Shared Test State
// ============================================================================
// This section builds only the state fields the NPC handler reads. Keeping the
// state narrow makes it clear which contracts the handler actually depends on.
// ============================================================================
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

describe('handleTalk quest handoff', () => {
  const gameTime = new Date(Date.UTC(2026, 5, 9, 13, 0, 0));
  const mockDispatch = vi.fn<(action: AppAction) => void>();
  const mockAddMessage = vi.fn<(message: string, channel: string) => void>();
  const mockAddGeminiLog = vi.fn();
  const mockPlayPcmAudio = vi.fn(async () => undefined);

  const mockGameState = {
    gameTime,
    metNpcIds: ['villager_generic'],
    npcMemory: {
      villager_generic: {
        disposition: 0,
        goals: [],
      },
    },
    lastInteractedNpcId: null,
    lastNpcResponse: null,
    questLog: [],
    companions: {},
    activeConversation: null,
    activeDialogueSession: null,
  } as unknown as GameState;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a source-backed quest when an NPC dialogue outcome carries a minimal quest offer', async () => {
    // The offer carries only the quest id. The handler should resolve the full
    // legacy quest payload from the existing quest registry before dispatching.
    const action: Action = {
      type: 'talk',
      payload: {
        targetNpcId: 'villager_generic',
        questOffer: { questId: 'herbalist_supplies' },
      },
    } as Action;

    await handleTalk({
      action,
      gameState: mockGameState,
      dispatch: mockDispatch as unknown as Dispatch<AppAction>,
      addMessage: mockAddMessage,
      addGeminiLog: mockAddGeminiLog,
      playPcmAudio: mockPlayPcmAudio,
      playerContext: 'Test adventurer',
      generalActionContext: 'Testing quest handoff',
    });

    const acceptedQuestCall = mockDispatch.mock.calls.find(([dispatched]) => dispatched.type === 'ACCEPT_QUEST');
    expect(acceptedQuestCall).toBeDefined();
    expect(acceptedQuestCall?.[0].payload).toMatchObject({
      id: 'herbalist_supplies',
      title: "Herbalist's Helper",
      giverId: 'tilda_herbalist',
    });
    expect(mockDispatch.mock.calls.some(([dispatched]) => dispatched.type === 'START_DIALOGUE_SESSION')).toBe(true);
  });

  it('keeps ordinary static NPC talk dialogue-only when no quest offer is present', async () => {
    // This guards the existing behavior: talking to an NPC still opens dialogue
    // and updates social memory, but does not start a quest by default.
    const action: Action = {
      type: 'talk',
      payload: { targetNpcId: 'villager_generic' },
    };

    await handleTalk({
      action,
      gameState: mockGameState,
      dispatch: mockDispatch as unknown as Dispatch<AppAction>,
      addMessage: mockAddMessage,
      addGeminiLog: mockAddGeminiLog,
      playPcmAudio: mockPlayPcmAudio,
      playerContext: 'Test adventurer',
      generalActionContext: 'Testing normal dialogue',
    });

    expect(mockDispatch.mock.calls.some(([dispatched]) => dispatched.type === 'ACCEPT_QUEST')).toBe(false);
    expect(mockDispatch.mock.calls.some(([dispatched]) => dispatched.type === 'START_DIALOGUE_SESSION')).toBe(true);
  });
});
