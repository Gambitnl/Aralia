import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistorySync } from '../useHistorySync';
import { GamePhase, GameState } from '../../types';
import * as locationUtils from '@/utils/spatial';

// Mock dependencies
vi.mock('../../constants', () => ({
    LOCATIONS: {
        'loc_1': { id: 'loc_1', dynamicNpcConfig: null }
    },
    STARTING_LOCATION_ID: 'loc_1',
    ITEMS: {},
    CLASSES_DATA: {},
    NPCS: {},
    COMPANIONS: {},
}));

vi.mock('../../data/dev/dummyCharacter', () => ({
    getDummyParty: () => [],
    USE_DUMMY_CHARACTER_FOR_DEV: false,
    initialInventoryForDummyCharacter: [],
}));

vi.mock('@/utils/spatial');

import { initialGameState } from '../../state/initialState';

// Mock window.history and window.location
const pushStateMock = vi.fn();
const replaceStateMock = vi.fn();
const addEventListenerMock = vi.fn();
const removeEventListenerMock = vi.fn();

describe('useHistorySync', () => {
    let gameState: GameState;
    const dispatch = vi.fn();
    let mockLocation: { pathname: string; search: string };

    beforeEach(() => {
        gameState = { ...initialGameState, phase: GamePhase.MAIN_MENU };
        vi.resetAllMocks();

        vi.mocked(locationUtils.determineActiveDynamicNpcsForLocation).mockReturnValue(['npc_1']);

        // Mock History
        Object.defineProperty(window, 'history', {
            value: {
                pushState: pushStateMock,
                replaceState: replaceStateMock,
                state: null
            },
            writable: true
        });

        // Mock Location
        // We use a proxy object to allow reading/writing search
        mockLocation = { pathname: '/', search: '' };

        // Try to delete first to handle JSDOM constraints
        try {
            delete (window as any).location;
        } catch {
            // Ignore error if location can't be deleted
        }

        Object.defineProperty(window, 'location', {
            get: () => mockLocation,
            configurable: true,
        });

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
    });

    it('should prioritize URL phase on initial mount (Deep Link)', () => {
        mockLocation.search = '?phase=character_creation';
        renderHook(() => useHistorySync(gameState, dispatch));
        expect(replaceStateMock).not.toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalledWith({
            type: 'SET_GAME_PHASE',
            payload: GamePhase.CHARACTER_CREATION
        });
    });

    it('should push new state to history when game phase changes', () => {
        const { rerender } = renderHook(({ state }) => useHistorySync(state, dispatch), {
            initialProps: { state: gameState }
        });
        replaceStateMock.mockClear();

        // Simulate that the URL was updated by the previous render
        mockLocation.search = '?phase=main_menu';

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
        const popStateCallback = addEventListenerMock.mock.calls.find(call => call[0] === 'popstate')?.[1];
        if (!popStateCallback) {
            throw new Error('popstate listener not registered');
        }

        // When popstate happens, the URL is already changed by the browser
        mockLocation.search = '?phase=character_creation';

        const event = new PopStateEvent('popstate', {
            state: { phase: GamePhase.CHARACTER_CREATION }
        });
        act(() => { popStateCallback(event); });

        expect(dispatch).toHaveBeenCalledWith({
            type: 'SET_GAME_PHASE',
            payload: GamePhase.CHARACTER_CREATION
        });
    });

    it('should block navigation to PLAYING if no party exists', () => {
        gameState.party = [];
        // User navigates to PLAYING
        mockLocation.search = '?phase=playing';

        renderHook(() => useHistorySync(gameState, dispatch));

        // Simulate popstate for the navigation
        // Actually, if we use renderHook, it runs the effect.
        // The effect checks URL.

        // Wait, the effect runs on mount. If URL is playing, it checks party.
        // It sees no party.

        expect(dispatch).not.toHaveBeenCalledWith({ type: 'SET_GAME_PHASE', payload: GamePhase.PLAYING });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'ADD_NOTIFICATION',
            payload: {
                message: "You cannot travel there without an active party.",
                type: 'warning',
                duration: 4000
            }
        });
        expect(replaceStateMock).toHaveBeenCalledWith(
            { phase: GamePhase.MAIN_MENU },
            '',
            '/?phase=main_menu'
        );
    });

    it('should preserve existing query params', () => {
        mockLocation.search = '?debug=true&foo=bar';
        const { rerender } = renderHook(({ state }) => useHistorySync(state, dispatch), {
            initialProps: { state: gameState }
        });

        expect(replaceStateMock).toHaveBeenCalledWith(
            { phase: GamePhase.MAIN_MENU },
            '',
            '/?debug=true&foo=bar&phase=main_menu'
        );

        // Simulate URL update
        mockLocation.search = '?debug=true&foo=bar&phase=main_menu';

        const newState = { ...gameState, phase: GamePhase.CHARACTER_CREATION };
        rerender({ state: newState });

        expect(pushStateMock).toHaveBeenCalledWith(
            { phase: GamePhase.CHARACTER_CREATION },
            '',
            '/?debug=true&foo=bar&phase=character_creation'
        );
    });

    it('should persist subMapCoordinates and currentLocationId in URL when playing', () => {
        const playingState = {
            ...gameState,
            phase: GamePhase.PLAYING,
            currentLocationId: 'loc_1',
            subMapCoordinates: { x: 10, y: 20 }
        };

        const { rerender } = renderHook(({ state }) => useHistorySync(state, dispatch), {
            initialProps: { state: playingState }
        });

        // Verify initial persistence
        expect(replaceStateMock).toHaveBeenCalledWith(
            { phase: GamePhase.PLAYING },
            '',
            expect.stringContaining('x=10')
        );

        // Simulate URL update to match what we just set
        mockLocation.search = '?phase=playing&x=10&y=20&loc=loc_1';

        replaceStateMock.mockClear();
        pushStateMock.mockClear();

        // Move player
        const movedState = { ...playingState, subMapCoordinates: { x: 11, y: 21 } };
        rerender({ state: movedState });

        // Should use replaceState because phase is same
        expect(replaceStateMock).toHaveBeenCalledWith(
            { phase: GamePhase.PLAYING },
            '',
            expect.stringContaining('x=11')
        );
        expect(replaceStateMock).toHaveBeenCalledWith(
            { phase: GamePhase.PLAYING },
            '',
            expect.stringContaining('y=21')
        );
        expect(replaceStateMock).toHaveBeenCalledWith(
            { phase: GamePhase.PLAYING },
            '',
            expect.stringContaining('loc=loc_1')
        );
        expect(pushStateMock).not.toHaveBeenCalled();
    });

    it('should dispatch MOVE_PLAYER on initial mount if coords present in URL', () => {
        mockLocation.search = '?phase=playing&x=5&y=5&loc=loc_1';
        gameState.party = [{ id: 'p1', name: 'Test', class: { name: 'Fighter' } } as any];

        renderHook(() => useHistorySync(gameState, dispatch));

        // Should navigate to phase
        expect(dispatch).toHaveBeenCalledWith({
            type: 'SET_GAME_PHASE',
            payload: GamePhase.PLAYING
        });

        // Should dispatch move
        expect(dispatch).toHaveBeenCalledWith({
            type: 'MOVE_PLAYER',
            payload: {
                newLocationId: 'loc_1',
                newSubMapCoordinates: { x: 5, y: 5 },
                activeDynamicNpcIds: ['npc_1']
            }
        });
    });

    it('should navigate to NOT_FOUND when phase param is invalid', () => {
        // Setup URL with invalid phase
        mockLocation.search = '?phase=invalid_phase';

        renderHook(() => useHistorySync(gameState, dispatch));

        // Check if dispatch was called with NOT_FOUND
        expect(dispatch).toHaveBeenCalledWith({
            type: 'SET_GAME_PHASE',
            payload: GamePhase.NOT_FOUND
        });
    });
});
