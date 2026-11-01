import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppAction } from '../../state/actionTypes';
import { uiReducer } from '../../state/reducers/uiReducer';
import type { Action, GameState } from '../../types';
import { createMockGameState } from '../../utils/core/factories';
import { useGameActions } from '../useGameActions';

/**
 * This file proves that player actions keep the exploration interface locked for the
 * entire asynchronous handler lifecycle.
 *
 * The tests run the real useGameActions hook and the real UI reducer while replacing
 * specialised action handlers with controllable promises. That combination catches
 * dispatch-order regressions that a dispatch spy alone would miss, including the stale
 * error clear that previously switched loading off immediately after it was switched on.
 *
 * Called by: focused Vitest verification for useGameActions.
 * Depends on: useGameActions.ts and uiReducer.ts.
 */

// ============================================================================
// Controllable Handler Registry
// ============================================================================
// The real registry reaches many game systems. These tests replace it with one handler
// whose completion or failure can be released at the exact point each assertion needs.
// ============================================================================
const handlerMock = vi.hoisted(() => vi.fn());
const buildActionHandlersMock = vi.hoisted(() => vi.fn(() => ({
  look_around: handlerMock,
  toggle_map: handlerMock,
  USE_ITEM: handlerMock,
  HAGGLE_ITEM: handlerMock,
  EQUIP_ITEM: handlerMock,
  UNEQUIP_ITEM: handlerMock,
})));

vi.mock('../actions/actionHandlers', () => ({
  buildActionHandlers: buildActionHandlersMock,
}));

interface DeferredAction {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
}

// Create a promise that remains pending until the test explicitly completes it. This
// represents network-backed and AI-backed actions without depending on real services.
function createDeferredAction(): DeferredAction {
  let resolve!: () => void;
  let reject!: (error: Error) => void;

  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

// ============================================================================
// Hook Harness
// ============================================================================
// The harness feeds every dispatched action through the real UI reducer, producing the
// same loading and error state that App.tsx uses to disable player controls.
// ============================================================================
function renderActionHarness(initialOverrides: Partial<GameState> = {}) {
  let visibleState = createMockGameState(initialOverrides);
  const dispatchedActions: AppAction[] = [];

  // Merge each UI reducer result into the current state so sequential lifecycle
  // dispatches behave exactly as they do in the application's combined reducer.
  const dispatch = vi.fn((action: AppAction) => {
    dispatchedActions.push(action);
    visibleState = { ...visibleState, ...uiReducer(visibleState, action) };
  });

  // Unrelated action services use inert deterministic values because these tests only
  // exercise lifecycle orchestration, not authored narrative or world lookup behavior.
  const hook = renderHook(() => useGameActions({
    gameState: visibleState,
    dispatch,
    addMessage: vi.fn(),
    playPcmAudio: vi.fn(async () => undefined),
    getCurrentLocation: vi.fn(() => ({
      id: 'test-clearing',
      name: 'Test Clearing',
      baseDescription: 'A quiet place used to verify action lifecycle behavior.',
      exits: {},
      biomeId: 'plains',
    })),
    getCurrentNPCs: vi.fn(() => []),
    getTileTooltipText: vi.fn(() => ''),
  }));

  return {
    ...hook,
    dispatch,
    dispatchedActions,
    getVisibleState: () => visibleState,
  };
}

// ============================================================================
// Lifecycle Guarantees
// ============================================================================
// These cases cover pending work, successful completion, failed completion, and the
// intentionally spinner-free interface toggles that must keep their existing behavior.
// ============================================================================
describe('useGameActions loading lifecycle', () => {
  beforeEach(() => {
    handlerMock.mockReset();
    buildActionHandlersMock.mockClear();
  });

  // Restore console interception after failure-path cases so this focused suite cannot
  // hide diagnostics from later tests that share the same Vitest worker.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps controls gated while an asynchronous action is pending, then releases them on success', async () => {
    const deferred = createDeferredAction();
    handlerMock.mockReturnValueOnce(deferred.promise);
    const harness = renderActionHarness({ error: 'A stale action error' });
    let actionPromise!: Promise<void>;

    // Start without awaiting completion so the observable state represents the period
    // when an asynchronous handler is still working.
    act(() => {
      actionPromise = harness.result.current.processAction({ type: 'look_around' });
    });

    await vi.waitFor(() => expect(handlerMock).toHaveBeenCalledTimes(1));

    // App.tsx derives control interactivity from !isLoading, so true here proves the
    // action buttons remain disabled instead of accepting duplicate input.
    expect(harness.getVisibleState()).toMatchObject({
      error: null,
      isLoading: true,
      loadingMessage: 'Processing action...',
    });
    expect(harness.dispatchedActions.slice(0, 2)).toEqual([
      { type: 'SET_ERROR', payload: null },
      { type: 'SET_LOADING', payload: { isLoading: true, message: 'Processing action...' } },
    ]);

    // Completing the handler must release the same gate through the common finally path.
    deferred.resolve();
    await act(async () => {
      await actionPromise;
    });

    expect(harness.getVisibleState()).toMatchObject({
      error: null,
      isLoading: false,
      loadingMessage: null,
    });
  });

  it.each(['USE_ITEM', 'HAGGLE_ITEM'] as const)('releases controls after %s settles', async (type) => {
    // Both handlers finish at the shared action boundary. Neither owns a
    // second spinner lifecycle or needs an AI response to release controls.
    handlerMock.mockReturnValueOnce(undefined);
    const harness = renderActionHarness();
    await act(async () => {
      await harness.result.current.processAction({
        type, payload: type === 'USE_ITEM'
          ? { characterId: 'meal-actor', itemId: 'rations' }
          : { merchantId: 'source-keeper', strategy: 'persuade' },
      } as Action);
    });
    expect(handlerMock).toHaveBeenCalledTimes(1);
    expect(harness.getVisibleState()).toMatchObject({ isLoading: false, loadingMessage: null });
    expect(harness.dispatchedActions.at(-1)).toEqual({
      type: 'SET_LOADING', payload: { isLoading: false },
    });
  });

  it('records a handler failure and releases the loading gate', async () => {
    // The hook deliberately reports action failures for developers. Silence that expected
    // diagnostic here while retaining an assertion that the reporting path ran.
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const deferred = createDeferredAction();
    handlerMock.mockReturnValueOnce(deferred.promise);
    const harness = renderActionHarness();
    let actionPromise!: Promise<void>;

    act(() => {
      actionPromise = harness.result.current.processAction({ type: 'look_around' });
    });

    await vi.waitFor(() => expect(handlerMock).toHaveBeenCalledTimes(1));
    expect(harness.getVisibleState().isLoading).toBe(true);

    // Rejecting the handler exercises useGameActions' player-facing error recovery.
    deferred.reject(new Error('The scouting action failed'));
    await act(async () => {
      await actionPromise;
    });

    expect(harness.getVisibleState()).toMatchObject({
      error: 'The scouting action failed',
      isLoading: false,
      loadingMessage: null,
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[useGameActions] Error in look_around:',
      expect.any(Error),
    );
  });

  it('reports action setup failure and releases controls before a handler can run', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failure = new Error('Action registry is unavailable');
    buildActionHandlersMock.mockImplementationOnce(() => { throw failure; });
    const harness = renderActionHarness();
    // Registry setup must recover without applying equipment or waiting for a watchdog.
    await act(async () => {
      await harness.result.current.processAction({
        type: 'EQUIP_ITEM', payload: {characterId: 'preparing-bard', itemId: 'club'},
      });
    });
    expect(handlerMock).not.toHaveBeenCalled();
    expect(harness.dispatchedActions.some(action => action.type === 'EQUIP_ITEM')).toBe(false);
    expect(harness.getVisibleState()).toMatchObject({
      error: failure.message, isLoading: false, loadingMessage: null,
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('[useGameActions] Error in EQUIP_ITEM:', failure);
  });

  it.each(['EQUIP_ITEM', 'UNEQUIP_ITEM'] as const)('releases preparation controls immediately after %s', async (type) => {
    const harness = renderActionHarness();
    // Equipment handlers only dispatch their synchronous reducer update. The
    // common action boundary must finish the spinner without the watchdog.
    handlerMock.mockImplementationOnce((action: Action) => {
      if (action.type === 'EQUIP_ITEM' || action.type === 'UNEQUIP_ITEM') {
        harness.dispatch({type, payload: action.payload} as AppAction);
      }
    });
    await act(async () => {
      await harness.result.current.processAction({
        type,
        payload: type === 'EQUIP_ITEM'
          ? {characterId: 'preparing-bard', itemId: 'club'}
          : {characterId: 'preparing-bard', slot: 'OffHand'},
      } as Action);
    });
    expect(handlerMock).toHaveBeenCalledTimes(1);
    expect(harness.getVisibleState()).toMatchObject({isLoading: false, loadingMessage: null});
  });

  it('keeps synchronous interface toggles spinner-free while still clearing stale errors', async () => {
    handlerMock.mockResolvedValueOnce(undefined);
    const harness = renderActionHarness({ error: 'Old map error' });

    await act(async () => {
      await harness.result.current.processAction({ type: 'toggle_map' } as Action);
    });

    expect(harness.getVisibleState()).toMatchObject({
      error: null,
      isLoading: false,
      loadingMessage: null,
    });
    expect(harness.dispatchedActions.filter(action => action.type === 'SET_LOADING')).toEqual([]);
  });
});
