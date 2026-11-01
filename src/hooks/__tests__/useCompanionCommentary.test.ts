import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompanionCommentary } from '../useCompanionCommentary';
import { GameState } from '../../types';
import { GamePhase } from '../../types/core';
import { COMPANIONS } from '../../data/companions';
import { CompanionReactionRule, Companion } from '../../types/companions';
import { DEFAULT_WEATHER } from '../../systems/environment/EnvironmentSystem';
import { OllamaService } from '../../services/ollama';

vi.mock('../../services/ollama', () => ({
  OllamaService: {
    isAvailable: vi.fn().mockResolvedValue(false),
    generateReaction: vi.fn(),
  },
}));

describe('useCompanionCommentary', () => {
  let mockDispatch: ReturnType<typeof vi.fn<Parameters<typeof useCompanionCommentary>[1]>>;
  let mockState: GameState;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(OllamaService.isAvailable).mockResolvedValue(false);
    mockDispatch = vi.fn();

    // Deep copy/modification of COMPANIONS to ensure predictable test data
    const mockCompanions = JSON.parse(JSON.stringify(COMPANIONS)); Object.values(mockCompanions).forEach((c: any) => { c.inParty = true; if (!c.memories) c.memories = []; });

    // Ensure Kaelen has a cooldown on his loot reaction for the cooldown test
    if (mockCompanions['kaelen_thorne']) {
      const lootRule = mockCompanions['kaelen_thorne'].reactionRules.find((r: CompanionReactionRule) => r.triggerType === 'loot');
      if (lootRule) {
        lootRule.cooldown = 1; // 1 minute cooldown
        lootRule.chance = 1.0; // Ensure it passes chance check
      }
    }

    mockState = {
      phase: GamePhase.PLAYING,
      party: [],
      tempParty: null,
      inventory: [],
      companions: mockCompanions,
      currentLocationId: 'loc_1',
      messages: [],
      gold: 0,
      notoriety: {
        globalHeat: 0,
        localHeat: {},
        knownCrimes: [],
        bounties: []
      },
      // Provide minimal state for commentary context construction.
      questLog: [],
      dynamicLocations: { loc_1: { name: 'Test Location' } },
      environment: { ...DEFAULT_WEATHER },
      gameTime: new Date().toISOString()
    } as unknown as GameState;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should trigger a loot reaction when gold increases significantly', async () => {
    const { rerender } = renderHook(({ state }) => useCompanionCommentary(state, mockDispatch as any), {
      initialProps: { state: mockState }
    });

    // Clear the startup delay guard before triggering reactions.
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    vi.spyOn(Math, 'random').mockReturnValue(0);

    const newState = {
      ...mockState,
      gold: 100,
      messages: [...mockState.messages as any, { text: "You found 100 gold." } as any]
    } as GameState;

    await act(async () => {
      rerender({ state: newState });
      vi.runAllTimers();
    });

    // Wait for microtasks
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ADD_COMPANION_REACTION',
      payload: expect.objectContaining({
        companionId: 'kaelen_thorne'
      })
    }));
  });

  it('should respect cooldowns for loot reactions', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const { rerender } = renderHook(({ state }) => useCompanionCommentary(state, mockDispatch as any), {
      initialProps: { state: mockState }
    });

    // Clear the startup delay guard before triggering reactions.
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Trigger first reaction
    const newState = {
      ...mockState,
      gold: 100,
      messages: [...mockState.messages as any, { text: "You found 100 gold." } as any]
    } as GameState;

    await act(async () => {
      rerender({ state: newState });
      vi.runAllTimers();
    });

    // Wait for microtasks
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    mockDispatch.mockClear();

    // Advance time slightly but stay within cooldown (e.g. 30 seconds)
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });

    // Trigger again immediately (within 1 minute cooldown)
    const newerState = {
      ...newState,
      gold: 200,
      messages: [...(newState as any).messages, { text: "You found another 100 gold." } as any]
    } as GameState;

    await act(async () => {
      rerender({ state: newerState });
      vi.runAllTimers();
    });

    // Wait for microtasks
    await act(async () => {
      await Promise.resolve();
    });


    await act(async () => {
      rerender({ state: newerState });
      vi.runAllTimers();
    });

    // Wait for microtasks
    await act(async () => {
      await Promise.resolve();
    });

    // Should be blocked by cooldown
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  // --- NEW CRIME TESTS ---

  it.each([false, undefined])('does not give an absent companion loot knowledge or approval (inParty=%s)', async inParty => {
    const remembered = { ...mockState.companions.kaelen_thorne, inParty };
    const state = { ...mockState, companions: { kaelen_thorne: remembered } };
    const { rerender } = renderHook(({ state }) => useCompanionCommentary(state, mockDispatch), {
      initialProps: { state },
    });
    await act(async () => { vi.advanceTimersByTime(5000); });
    await act(async () => {
      rerender({ state: { ...state, gold: 100, messages: [{ text: 'You found 100 gold.' } as any] } });
    });
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(OllamaService.isAvailable).not.toHaveBeenCalled();
    expect(state.companions.kaelen_thorne).toBe(remembered);
  });

  it('drops a pending reaction when its speaker leaves the party', async () => {
    let finishAvailability!: (available: boolean) => void;
    vi.mocked(OllamaService.isAvailable).mockImplementationOnce(() => new Promise(resolve => { finishAvailability = resolve; }));
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { rerender } = renderHook(({ state }) => useCompanionCommentary(state, mockDispatch), {
      initialProps: { state: mockState },
    });
    await act(async () => { vi.advanceTimersByTime(5000); });
    const looted = { ...mockState, gold: 100, messages: [{ text: 'You found 100 gold.' } as any] };
    await act(async () => { rerender({ state: looted }); });
    await act(async () => {
      rerender({ state: { ...looted, companions: {
        ...looted.companions,
        kaelen_thorne: { ...looted.companions.kaelen_thorne, inParty: false },
      } } });
    });
    await act(async () => { finishAvailability(false); });
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('should trigger reaction when a crime is committed', async () => {
    const mockCompanion: Companion = {
      id: 'test_comp',
      inParty: true,
      identity: {
        id: 'test_comp',
        name: 'TestComp',
        race: 'Human',
        class: 'Fighter',
        background: 'Soldier',
        sex: 'Unknown',
        age: 30,
        physicalDescription: 'TBD'
      },
      personality: { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 50, values: [], fears: [], quirks: [] },
      goals: [],
      memories: [],
      discoveredFacts: [],
      relationships: { player: { targetId: 'player', level: 'acquaintance', approval: 0, history: [], unlocks: [] } },
      loyalty: 50,
      approvalHistory: [],
      reactionRules: [
        {
          triggerType: 'crime_committed',
          triggerTags: ['theft'],
          approvalChange: 5,
          dialoguePool: ['Nice theft!'],
          chance: 1
        }
      ]
    };

    const testState = {
      ...mockState,
      companions: { test_comp: mockCompanion }
    };

    const { rerender } = renderHook(
      ({ state }) => useCompanionCommentary(state as GameState, mockDispatch as any),
      { initialProps: { state: testState } }
    );

    // Clear the startup delay guard before triggering reactions.
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    // Simulate crime committed
    const updatedState = {
      ...testState,
      notoriety: {
        ...testState.notoriety!,
        knownCrimes: [
          {
            id: 'crime_1',
            type: 'Theft',
            severity: 10,
            locationId: 'loc_1',
            timestamp: Date.now(),
            witnessed: false
          } as any
        ]
      }
    };

    await act(async () => {
      rerender({ state: updatedState });
    });

    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ADD_COMPANION_REACTION',
      payload: expect.objectContaining({
        companionId: 'test_comp',
        reaction: 'Nice theft!'
      })
    }));

    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'UPDATE_COMPANION_APPROVAL',
      payload: expect.objectContaining({
        companionId: 'test_comp',
        change: 5,
        reason: 'Reaction to crime_committed'
      })
    }));
  });
});







