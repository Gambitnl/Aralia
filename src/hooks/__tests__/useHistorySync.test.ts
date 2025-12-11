import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistorySync } from '../useHistorySync';
import { GamePhase, GameState } from '../../types';
import { initialGameState } from '../../state/appState';

// Mock window.history and window.location
const pushStateMock = vi.fn();
const replaceStateMock = vi.fn();
const addEventListenerMock = vi.fn();
const removeEventListenerMock = vi.fn();

describe('useHistorySync', () => {
    let gameState: GameState;
    const dispatch = vi.fn();

    beforeEach(() => {
        gameState = { ...initialGameState, phase: GamePhase.MAIN_MENU };
        vi.resetAllMocks();

        // Setup Window mocks
        Object.defineProperty(window, 'history', {
            value: {
                pushState: pushStateMock,
                replaceState: replaceStateMock,
                state: null
            },
            writable: true
        });

        // Mock window.location
        delete (window as any).location;
        (window as any).location = {
            pathname: '/',
            search: '',
        };

        window.addEventListener = addEventListenerMock;
        window.removeEventListener = removeEventListenerMock;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should update URL on initial mount (replaceState)', () => {
        renderHook(() => useHistorySync(gameState, dispatch));

        expect(replaceStateMock).toHaveBeenCalledWith(
            { phase: GamePhase.MAIN_MENU },
            '',
            '/?phase=main_menu'
        );
        expect(pushStateMock).not.toHaveBeenCalled();
    });

    it('should prioritize URL phase on initial mount (Deep Link)', () => {
        // Setup deep link URL
        (window as any).location.search = '?phase=character_creation';

        renderHook(() => useHistorySync(gameState, dispatch));

        // Should NOT overwrite URL with MAIN_MENU
        expect(replaceStateMock).not.toHaveBeenCalled();

        // Should dispatch action to update state to match URL
        expect(dispatch).toHaveBeenCalledWith({
            type: 'SET_GAME_PHASE',
            payload: GamePhase.CHARACTER_CREATION
        });
    });

    it('should push new state to history when game phase changes', () => {
        const { rerender } = renderHook(({ state }) => useHistorySync(state, dispatch), {
            initialProps: { state: gameState }
        });

        // First render happens (initial sync)
        replaceStateMock.mockClear();

        // Change phase
        const newState = { ...gameState, phase: GamePhase.CHARACTER_CREATION };
        rerender({ state: newState });

        expect(pushStateMock).toHaveBeenCalledWith(
            { phase: GamePhase.CHARACTER_CREATION },
            '',
            '/?phase=character_creation'
        );
    });

    it('should dispatch SET_GAME_PHASE on popstate event', () => {
        renderHook(() => useHistorySync(gameState, dispatch));

        // Find the event listener
        const popStateCallback = addEventListenerMock.mock.calls.find(call => call[0] === 'popstate')[1];
        expect(popStateCallback).toBeDefined();

        // Simulate popstate event (e.g., user clicked Back to Character Creation)
        const event = new PopStateEvent('popstate', {
            state: { phase: GamePhase.CHARACTER_CREATION }
        });

        act(() => {
            popStateCallback(event);
        });

        expect(dispatch).toHaveBeenCalledWith({
            type: 'SET_GAME_PHASE',
            payload: GamePhase.CHARACTER_CREATION
        });
    });

    it('should block navigation to PLAYING if no party exists', () => {
        // Ensure no party
        gameState.party = [];
        renderHook(() => useHistorySync(gameState, dispatch));

        const popStateCallback = addEventListenerMock.mock.calls.find(call => call[0] === 'popstate')[1];

        // Try to navigate to PLAYING
        const event = new PopStateEvent('popstate', {
            state: { phase: GamePhase.PLAYING }
        });

        act(() => {
            popStateCallback(event);
        });

        // Should NOT dispatch
        expect(dispatch).not.toHaveBeenCalled();

        // Should revert URL (replaceState back to current phase)
        expect(replaceStateMock).toHaveBeenCalledWith(
            { phase: GamePhase.MAIN_MENU },
            '',
            '/?phase=main_menu'
        );
    });

    it('should preserve existing query params', () => {
        (window as any).location.search = '?debug=true&foo=bar';

        const { rerender } = renderHook(({ state }) => useHistorySync(state, dispatch), {
            initialProps: { state: gameState }
        });

        // First render happens (initial sync) - should preserve params
        expect(replaceStateMock).toHaveBeenCalledWith(
            { phase: GamePhase.MAIN_MENU },
            '',
            '/?debug=true&foo=bar&phase=main_menu'
        );

        // Change phase
        const newState = { ...gameState, phase: GamePhase.CHARACTER_CREATION };
        rerender({ state: newState });

        expect(pushStateMock).toHaveBeenCalledWith(
            { phase: GamePhase.CHARACTER_CREATION },
            '',
            '/?debug=true&foo=bar&phase=character_creation'
        );
    });
});
