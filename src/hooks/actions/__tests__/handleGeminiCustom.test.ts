/**
 * This test file protects the custom Gemini action handler's memory-touch paths.
 *
 * Social checks update NPC disposition and facts, targeted custom prompts can
 * attach a direct fact to a named NPC, and egregious custom actions now refresh
 * witness recency after gossip lands. The test mocks the AI and entity-linking
 * boundaries, then verifies only the memory actions this handler owns.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Dispatch } from 'react';
import { handleGeminiCustom } from '../handleGeminiCustom';
import * as GeminiService from '../../../services/geminiService';
import * as WorldEvents from '../handleWorldEvents';
import type { Action, GameState } from '../../../types';
import type { AppAction } from '../../../state/actionTypes';
import type {
  AddGeminiLogFn,
  AddMessageFn,
  GetCurrentLocationFn,
  GetCurrentNPCsFn,
} from '../actionHandlerTypes';

// This test stays narrow on the social-check branch because the new coverage
// goal is about proving the handler now stamps memory recency, not about
// revalidating the rest of the Gemini action surface.
vi.mock('../../../services/geminiService');
vi.mock('../handleWorldEvents', () => ({
  handleImmediateGossip: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../utils/socialUtils', () => ({
  assessPlausibility: vi.fn(() => 0),
}));
vi.mock('../../../utils/entityIntegrationUtils', () => ({
  resolveAndRegisterEntities: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../constants', () => ({
  NPCS: {
    npc_1: {
      id: 'npc_1',
      name: 'Test NPC',
      initialPersonalityPrompt: 'calm and watchful',
      voice: { name: 'Test Voice' },
    },
  },
}));
vi.mock('../../../data/skills', () => ({
  SKILLS_DATA: {
    persuasion: { id: 'persuasion', name: 'Persuasion', ability: 'charisma' },
  },
}));

describe('handleGeminiCustom', () => {
  const mockDispatch = vi.fn<Dispatch<AppAction>>();
  const mockAddMessage = vi.fn<AddMessageFn>();
  const mockAddGeminiLog = vi.fn<AddGeminiLogFn>();
  const mockGetCurrentLocation = vi.fn<GetCurrentLocationFn>().mockReturnValue({ id: 'loc_1', npcIds: [] } as ReturnType<GetCurrentLocationFn>);
  const mockGetCurrentNPCs = vi.fn<GetCurrentNPCsFn>().mockReturnValue([]);
  const mockedGenerateSocialCheckOutcome = vi.mocked(GeminiService.generateSocialCheckOutcome);
  const mockedGenerateActionOutcome = vi.mocked(GeminiService.generateActionOutcome);
  const mockedHandleImmediateGossip = vi.mocked(WorldEvents.handleImmediateGossip);

  const gameTime = new Date(Date.UTC(2026, 5, 9, 12, 0, 0));

  const mockGameState = {
    party: [
      {
        name: 'Player One',
        finalAbilityScores: { charisma: 14 },
        skills: [{ id: 'persuasion', name: 'Persuasion' }],
        proficiencyBonus: 2,
      },
    ],
    npcMemory: {
      npc_1: {
        interactions: [],
        knownFacts: [],
        attitude: 0,
        disposition: 10,
        suspicion: 0,
        goals: [],
        lastInteractionTimestamp: 0,
        lastInteractionDate: 0,
        discussedTopics: {},
      },
    },
    gameTime,
    devModelOverride: null,
  } as unknown as GameState;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0.99);

    mockedGenerateSocialCheckOutcome.mockResolvedValue({
      data: {
        text: 'The NPC softens.',
        promptSent: 'prompt',
        rawResponse: 'response',
        dispositionChange: 3,
        memoryFactText: 'Test fact',
      },
      metadata: {},
      error: null,
    });
    mockedHandleImmediateGossip.mockResolvedValue(undefined);
  });

  it('stamps interaction recency when a social check writes memory', async () => {
    const socialCheckAction: Action = {
      type: 'gemini_custom_action',
      label: 'Persuade',
      payload: { check: 'Persuasion', targetNpcId: 'npc_1' },
    };

    await handleGeminiCustom({
      action: socialCheckAction,
      gameState: mockGameState,
      dispatch: mockDispatch,
      addMessage: mockAddMessage,
      addGeminiLog: mockAddGeminiLog,
      generalActionContext: 'Test context',
      getCurrentLocation: mockGetCurrentLocation,
      getCurrentNPCs: mockGetCurrentNPCs,
    });

    const interactionTimestampCall = mockDispatch.mock.calls.find(([action]) => action.type === 'UPDATE_NPC_INTERACTION_TIMESTAMP');
    expect(interactionTimestampCall).toBeDefined();
    expect(interactionTimestampCall?.[0].payload).toEqual({
      npcId: 'npc_1',
      timestamp: gameTime.getTime(),
    });

    expect(mockDispatch.mock.calls.some(([action]) => action.type === 'ADD_NPC_KNOWN_FACT')).toBe(true);
    expect(mockDispatch.mock.calls.some(([action]) => action.type === 'UPDATE_NPC_DISPOSITION')).toBe(true);
  });

  it('stamps interaction recency when a targeted custom prompt writes memory', async () => {
    mockedGenerateActionOutcome.mockResolvedValue({
      data: {
        text: 'The NPC gives you a terse answer.',
        promptSent: 'prompt',
        rawResponse: 'response',
      },
      metadata: {},
      error: null,
    });

    const customPromptAction: Action = {
      type: 'gemini_custom_action',
      label: 'Ask quietly',
      payload: {
        geminiPrompt: 'Ask the NPC for a private update',
        targetNpcId: 'npc_1',
      },
    };

    await handleGeminiCustom({
      action: customPromptAction,
      gameState: mockGameState,
      dispatch: mockDispatch,
      addMessage: mockAddMessage,
      addGeminiLog: mockAddGeminiLog,
      generalActionContext: 'Test context',
      getCurrentLocation: mockGetCurrentLocation,
      getCurrentNPCs: mockGetCurrentNPCs,
    });

    const interactionTimestampCall = mockDispatch.mock.calls.find(([action]) => action.type === 'UPDATE_NPC_INTERACTION_TIMESTAMP');
    expect(interactionTimestampCall).toBeDefined();
    expect(interactionTimestampCall?.[0].payload).toEqual({
      npcId: 'npc_1',
      timestamp: gameTime.getTime(),
    });

    expect(mockDispatch.mock.calls.some(([action]) => action.type === 'ADD_NPC_KNOWN_FACT')).toBe(true);
  });

  it('stamps witness recency after an egregious custom prompt spreads gossip', async () => {
    mockedGenerateActionOutcome.mockResolvedValue({
      data: {
        text: 'The NPC gives you a terse answer.',
        promptSent: 'prompt',
        rawResponse: 'response',
      },
      metadata: {},
      error: null,
    });
    mockGetCurrentNPCs.mockReturnValue([
      { id: 'npc_1' },
      { id: 'npc_2' },
    ] as unknown as ReturnType<GetCurrentNPCsFn>);

    const egregiousAction: Action = {
      type: 'gemini_custom_action',
      label: 'Ask quietly',
      payload: {
        geminiPrompt: 'Ask the NPC for a private update',
        targetNpcId: 'npc_1',
        isEgregious: true,
      },
    };

    await handleGeminiCustom({
      action: egregiousAction,
      gameState: mockGameState,
      dispatch: mockDispatch,
      addMessage: mockAddMessage,
      addGeminiLog: mockAddGeminiLog,
      generalActionContext: 'Test context',
      getCurrentLocation: mockGetCurrentLocation,
      getCurrentNPCs: mockGetCurrentNPCs,
    });

    expect(mockedHandleImmediateGossip).toHaveBeenCalledWith(
      mockGameState,
      mockDispatch,
      mockAddGeminiLog,
      ['npc_2'],
      expect.objectContaining({
        text: 'The NPC gives you a terse answer.',
      }),
      'npc_1',
    );

    const interactionTimestampCalls = mockDispatch.mock.calls.filter(([action]) => action.type === 'UPDATE_NPC_INTERACTION_TIMESTAMP');
    expect(interactionTimestampCalls).toHaveLength(2);
    expect(interactionTimestampCalls.map(([action]) => action.payload.npcId).sort()).toEqual(['npc_1', 'npc_2']);
    expect(interactionTimestampCalls.every(([action]) => action.payload.timestamp === gameTime.getTime())).toBe(true);
  });
});
