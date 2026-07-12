/**
 * Rest action pipeline regressions.
 *
 * The tests keep pacing, time advancement, journal rollover, and modal-authored
 * choices together so a UI path cannot accidentally perform only the reducer
 * half of a short or long rest.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleLongRest, handleShortRest } from '../handleResourceActions';
import { createMockGameState, createMockPlayerCharacter } from '../../../utils/factories';
import { getGameDay } from '../../../utils/core';
import type { GameState } from '../../../types';
import { createInitialJournalState } from '../../../types/journal';
import type { AddMessageFn } from '../../actions/actionHandlerTypes';

vi.mock('../../../systems/planar/rest', () => ({
  checkPlanarRestRules: vi.fn(() => ({ messages: [], deniedCharacterIds: [] })),
}));

vi.mock('../handleWorldEvents', () => ({
  handleResidueChecks: vi.fn().mockResolvedValue(undefined),
  handleGossipEvent: vi.fn().mockResolvedValue(undefined),
  handleLongRestWorldEvents: vi.fn((gameState) => gameState.npcMemory),
}));

describe('handleShortRest', () => {
  let mockDispatch: ReturnType<typeof vi.fn>;
  let mockAddMessage: ReturnType<typeof vi.fn>;
  let baseState: GameState;

  beforeEach(() => {
    mockDispatch = vi.fn();
    mockAddMessage = vi.fn();
    baseState = createMockGameState({
      party: [createMockPlayerCharacter({ id: 'rest-1', hp: 5, maxHp: 10 })],
    });
  });

  it('blocks a short rest if the cooldown has not elapsed', () => {
    const gameTime = new Date(Date.UTC(351, 0, 1, 10, 0, 0));
    const state = {
      ...baseState,
      gameTime,
      shortRestTracker: {
        restsTakenToday: 1,
        lastRestDay: getGameDay(gameTime),
        lastRestEndedAtMs: gameTime.getTime() - 30 * 60 * 1000,
      },
    };

    handleShortRest({ gameState: state, dispatch: mockDispatch as any, addMessage: mockAddMessage as any });

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockAddMessage).toHaveBeenCalledWith(expect.stringContaining('short rest'), 'system');
  });

  it('blocks a short rest after the daily cap is reached', () => {
    const gameTime = new Date(Date.UTC(351, 0, 1, 12, 0, 0));
    const state = {
      ...baseState,
      gameTime,
      shortRestTracker: {
        restsTakenToday: 3,
        lastRestDay: getGameDay(gameTime),
        lastRestEndedAtMs: gameTime.getTime() - 3 * 3600 * 1000,
      },
    };

    handleShortRest({ gameState: state, dispatch: mockDispatch as any, addMessage: mockAddMessage as any });

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockAddMessage).toHaveBeenCalledWith(expect.stringContaining('short rests today'), 'system');
  });

  it('advances time and increments rest tracking when a rest is allowed', () => {
    const gameTime = new Date(Date.UTC(351, 0, 1, 9, 0, 0));
    const state = {
      ...baseState,
      gameTime,
      shortRestTracker: {
        restsTakenToday: 0,
        lastRestDay: getGameDay(gameTime),
        lastRestEndedAtMs: gameTime.getTime() - 5 * 3600 * 1000,
      },
    };

    handleShortRest({ gameState: state, dispatch: mockDispatch as any, addMessage: mockAddMessage as any });

    const shortRestAction = mockDispatch.mock.calls.find(([action]) => action.type === 'SHORT_REST');
    const advanceTimeAction = mockDispatch.mock.calls.find(([action]) => action.type === 'ADVANCE_TIME');

    expect(shortRestAction).toBeDefined();
    expect(shortRestAction?.[0].payload.shortRestTracker.restsTakenToday).toBe(1);
    expect(shortRestAction?.[0].payload.shortRestTracker.lastRestEndedAtMs).toBe(
      gameTime.getTime() + 3600 * 1000,
    );
    expect(advanceTimeAction).toBeDefined();
    expect(advanceTimeAction?.[0].payload.seconds).toBe(3600);
  });

  it('opens a new journal entry after long rest so queued quest events can flush into it', async () => {
    const gameTime = new Date(Date.UTC(351, 0, 1, 21, 0, 0));
    const state = createMockGameState({
      party: [createMockPlayerCharacter({ id: 'rest-1', hp: 5, maxHp: 10 })],
      gameTime,
      journal: {
        ...createInitialJournalState(),
        pendingEvents: [
          {
            id: 'pending-quest-1',
            type: 'quest_completed',
            timestamp: gameTime.getTime(),
            gameTime: gameTime.toISOString(),
            title: 'Quest Completed: Courier Run',
            description: 'Completed "Courier Run" and claimed its rewards.',
            questId: 'quest-1',
          },
        ],
      },
    });

    const racialRestChoices = {
      'rest-1': {
        adaptable: { skillIds: ['Survival'] },
      },
    };

    await handleLongRest({
      gameState: state,
      dispatch: mockDispatch as any,
      addMessage: mockAddMessage as any,
      addGeminiLog: vi.fn() as any,
      racialRestChoices,
    });

    const longRestAction = mockDispatch.mock.calls.find(([action]) => action.type === 'LONG_REST');
    const advanceTimeIndex = mockDispatch.mock.calls.findIndex(([action]) => action.type === 'ADVANCE_TIME');
    const addJournalIndex = mockDispatch.mock.calls.findIndex(([action]) => action.type === 'ADD_JOURNAL_ENTRY');
    const addJournalAction = mockDispatch.mock.calls.find(([action]) => action.type === 'ADD_JOURNAL_ENTRY');

    expect(longRestAction?.[0].payload).toMatchObject({ racialRestChoices });
    expect(advanceTimeIndex).toBeGreaterThan(-1);
    expect(addJournalIndex).toBeGreaterThan(-1);
    expect(addJournalIndex).toBeGreaterThan(advanceTimeIndex);
    expect(addJournalAction?.[0].payload).toMatchObject({
      narrativeText: expect.stringContaining('long rest'),
    });
  });
});
