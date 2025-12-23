import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCompanionCommentary } from '../useCompanionCommentary';
import { GameState } from '../../types';
import { COMPANIONS } from '../../data/companions';

describe('useCompanionCommentary', () => {
  let mockDispatch: any;
  let mockState: any;

  beforeEach(() => {
    mockDispatch = vi.fn();
    mockState = {
      companions: COMPANIONS,
      currentLocationId: 'loc_1',
      messages: [],
      gold: 0
    } as unknown as GameState;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should trigger a loot reaction when gold increases significantly', async () => {
    const { rerender } = renderHook(({ state }) => useCompanionCommentary(state, mockDispatch), {
      initialProps: { state: mockState }
    });

    vi.spyOn(Math, 'random').mockReturnValue(0);

    const newState = {
      ...mockState,
      gold: 100,
      messages: [...mockState.messages, { text: "You found 100 gold." }]
    };

    await act(async () => {
      rerender({ state: newState });
      vi.runAllTimers();
    });

    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ADD_COMPANION_REACTION',
      payload: expect.objectContaining({
        companionId: 'kaelen_thorne'
      })
    }));
  });

  it('should respect cooldowns', async () => {
     vi.spyOn(Math, 'random').mockReturnValue(0);

     const { rerender } = renderHook(({ state }) => useCompanionCommentary(state, mockDispatch), {
       initialProps: { state: mockState }
     });

     // Trigger first reaction
     const newState = {
       ...mockState,
       gold: 100,
       messages: [...mockState.messages, { text: "You found 100 gold." }]
     };

     await act(async () => {
        rerender({ state: newState });
        vi.runAllTimers();
     });

     expect(mockDispatch).toHaveBeenCalledTimes(1);
     mockDispatch.mockClear();

     // Advance time slightly but stay within cooldown (e.g. 30 seconds)
     await act(async () => {
        vi.advanceTimersByTime(30000);
     });

     // Trigger again immediately
     const newerState = {
       ...newState,
       gold: 200,
       messages: [...newState.messages, { text: "You found another 100 gold." }]
     };

     await act(async () => {
        rerender({ state: newerState });
        vi.runAllTimers();
     });

     // Should be blocked by cooldown
     expect(mockDispatch).not.toHaveBeenCalled();
  });
});