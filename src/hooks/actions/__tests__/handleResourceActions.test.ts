/**
 * Rest action pipeline regressions.
 *
 * The tests keep pacing, time advancement, journal rollover, and modal-authored
 * choices together so a UI path cannot accidentally perform only the reducer
 * half of a short or long rest.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleLongRest, handleShortRest } from '../handleResourceActions';
import { createMockGameState, createMockPlayerCharacter } from '../../../utils/core';
import { getGameDay } from '../../../utils/core';
import type { GameState } from '../../../types';
import type { AppAction } from '../../../state/actionTypes';
import { createInitialJournalState } from '../../../types/journal';
import type { AddMessageFn } from '../../actions/actionHandlerTypes';

vi.mock('../../../systems/planar/rest', async () => ({
  ...await vi.importActual<typeof import('../../../systems/planar/rest')>('../../../systems/planar/rest'),
  checkPlanarRestRules: vi.fn(() => ({ messages: [], deniedCharacterIds: [] })),
}));

vi.mock('../handleWorldEvents', () => ({
  handleResidueChecks: vi.fn().mockResolvedValue(undefined),
  handleGossipEvent: vi.fn().mockResolvedValue(undefined),
  handleLongRestWorldEvents: vi.fn((gameState) => gameState.npcMemory),
  // DIAL-002: the long rest now also runs the deterministic fact-propagation
  // pass; stubbed here for the same reason the gossip lane is.
  handleFactPropagationEvent: vi.fn(),
  // The long rest also nudges the town's occupant routines; stubbed for the
  // same reason the gossip lane is (it would build a canonical town roster).
  handleTownRoutineEvents: vi.fn().mockResolvedValue([]),
}));

describe('authored planar rest eligibility', () => {
  it('refuses an Astral long rest before any overnight mutation', async () => {
    const dispatch = vi.fn(), addMessage = vi.fn();
    const state = createMockGameState({
      party: [createMockPlayerCharacter({id: 'planar-traveler', hp: 5})],
      currentLocationId: 'astral-rest-site', lastLongRestAt: null,
      dynamicLocations: {'astral-rest-site': {id:'astral-rest-site', name:'Astral Rest Site',
        baseDescription:'An existing planar rule fixture.', exits:{}, biomeId:'astral', planeId:'astral'}},
    });
    await handleLongRest({gameState:state, dispatch, addMessage, addGeminiLog:vi.fn()});
    expect(dispatch).not.toHaveBeenCalled();
    expect(addMessage).toHaveBeenCalledWith('Long rests are not possible in The Astral Plane.', 'system');
  });
});

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

  it('resets an exhausted short-rest count when the rest finishes after midnight', () => {
    // This rest begins on an exhausted day but belongs to the new day when its
    // one-hour duration finishes. The real action path must therefore allow it
    // and record the fresh day's first rest without changing the time cost.
    const gameTime = new Date(Date.UTC(351, 0, 1, 23, 30, 0));
    const restEndMs = gameTime.getTime() + 3600 * 1000;
    const state = {
      ...baseState,
      gameTime,
      shortRestTracker: {
        restsTakenToday: 3,
        lastRestDay: getGameDay(gameTime),
        lastRestEndedAtMs: gameTime.getTime() - 3 * 3600 * 1000,
      },
    };

    handleShortRest({ gameState: state, dispatch: mockDispatch as unknown as React.Dispatch<AppAction>, addMessage: mockAddMessage as AddMessageFn });

    // Keep the mechanical rest update ahead of the authoritative clock update,
    // and prove the tracker uses the post-midnight day reached by that update.
    expect(mockDispatch.mock.calls.map(([action]) => action.type)).toEqual(['SHORT_REST', 'ADVANCE_TIME']);
    expect(mockDispatch.mock.calls[0][0].payload.shortRestTracker).toEqual({
      restsTakenToday: 1,
      lastRestDay: getGameDay(new Date(restEndMs)),
      lastRestEndedAtMs: restEndMs,
    });
    expect(mockDispatch.mock.calls[1][0]).toEqual({
      type: 'ADVANCE_TIME',
      payload: { seconds: 3600 },
    });
  });

  it('keeps the long-rest update, midnight-crossing clock advance, and journal entry in order', async () => {
    // The fixed timestamps make the day boundary part of the contract: the rest
    // starts late on one UTC game day and its eight-hour advance ends next day.
    const gameTime = new Date(Date.UTC(351, 0, 1, 21, 0, 0));
    const restEndMs = gameTime.getTime() + 8 * 3600 * 1000;
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

    const longRestIndex = mockDispatch.mock.calls.findIndex(([action]) => action.type === 'LONG_REST');
    const advanceTimeIndex = mockDispatch.mock.calls.findIndex(([action]) => action.type === 'ADVANCE_TIME');
    const addJournalIndex = mockDispatch.mock.calls.findIndex(([action]) => action.type === 'ADD_JOURNAL_ENTRY');
    const longRestAction = mockDispatch.mock.calls[longRestIndex]?.[0];
    const advanceTimeAction = mockDispatch.mock.calls[advanceTimeIndex]?.[0];
    const addJournalAction = mockDispatch.mock.calls.find(([action]) => action.type === 'ADD_JOURNAL_ENTRY');

    // Prove this scenario actually crosses midnight before checking the action
    // sequence that reducers consume to apply the rest, clock, and journal page.
    expect(gameTime.toISOString()).toBe('0351-01-01T21:00:00.000Z');
    expect(new Date(restEndMs).toISOString()).toBe('0351-01-02T05:00:00.000Z');
    expect(getGameDay(new Date(restEndMs))).not.toBe(getGameDay(gameTime));
    expect(longRestIndex).toBeGreaterThan(-1);
    expect(longRestAction?.payload).toMatchObject({ racialRestChoices });
    expect(advanceTimeIndex).toBeGreaterThan(longRestIndex);
    expect(advanceTimeAction).toEqual({ type: 'ADVANCE_TIME', payload: { seconds: 8 * 3600 } });
    expect(addJournalIndex).toBeGreaterThan(advanceTimeIndex);
    expect(addJournalAction?.[0].payload).toMatchObject({
      narrativeText: expect.stringContaining('long rest'),
    });
  });
  it('blocks a long rest if less than 16 hours have elapsed since the previous long rest (GG-449)', async () => {
    const gameTime = new Date('2026-06-01T12:00:00Z');
    const state = {
      ...baseState,
      gameTime,
      lastLongRestAt: new Date(gameTime.getTime() - 8 * 3600 * 1000).toISOString(), // 8 hours ago (< 16h cooldown)
    };

    await handleLongRest({
      gameState: state,
      dispatch: mockDispatch as any,
      addMessage: mockAddMessage as any,
      addGeminiLog: vi.fn() as any,
    });

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.stringContaining('must wait at least 8 hours before taking another long rest'),
      'system',
    );
  });

  it('notifies when a party member at 0 HP cannot benefit from a long rest (GG-449)', async () => {
    const gameTime = new Date('2026-06-01T12:00:00Z');
    const state = {
      ...baseState,
      gameTime,
      party: [
        createMockPlayerCharacter({ id: 'p1', name: 'Downed Hero', hp: 0, maxHp: 15 }),
        createMockPlayerCharacter({ id: 'p2', name: 'Healthy Hero', hp: 10, maxHp: 15 }),
      ],
    };

    await handleLongRest({
      gameState: state,
      dispatch: mockDispatch as any,
      addMessage: mockAddMessage as any,
      addGeminiLog: vi.fn() as any,
    });

    expect(mockAddMessage).toHaveBeenCalledWith(
      expect.stringContaining('Downed Hero is at 0 HP and gains no benefit from the long rest'),
      'system',
    );
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'LONG_REST' }),
    );
  });
});
