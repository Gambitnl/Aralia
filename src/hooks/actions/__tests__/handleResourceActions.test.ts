import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleShortRest } from '../handleResourceActions';
import { createMockGameState, createMockPlayerCharacter } from '../../../utils/factories';
import { getGameDay } from '../../../utils/core';
import type { GameState } from '../../../types';
import type { AddMessageFn } from '../../actions/actionHandlerTypes';

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

    handleShortRest({ gameState: state, dispatch: mockDispatch, addMessage: mockAddMessage as any as AddMessageFn });

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

    handleShortRest({ gameState: state, dispatch: mockDispatch, addMessage: mockAddMessage as any as AddMessageFn });

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

    handleShortRest({ gameState: state, dispatch: mockDispatch, addMessage: mockAddMessage as any as AddMessageFn });

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
});
