import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHistorySync } from '../useHistorySync';
import { GamePhase, GameState } from '../../types';
import * as locationUtils from '@/utils/spatial';

/**
 * ARCHITECTURAL CONTEXT:
 * This test suite validates the browser history synchronization logic 
 * (useHistorySync). It ensures that the application state (Redux-like phase) 
 * stays in sync with the browser URL and 'Forward/Back' buttons.
 *
 * Recent updates focus on 'Silent Guards' for deep-linking. When a user 
 * cold-loads the app via a shared URL (e.g. /?phase=playing), we block 
 * navigation if the state isn't ready (e.g. no party loaded yet). 
 * Crucially, we now suppress the warning notification during this initial 
 * mount to prevent 'Error Flash' before the store can rehydrate.
 * 
 * @file src/hooks/__tests__/useHistorySync.test.ts
 */

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

    it('should map the ?phase=spawnpreview deep link to SPAWN_PREVIEW', () => {
        mockLocation.search = '?phase=spawnpreview';
        renderHook(() => useHistorySync(gameState, dispatch));
        expect(replaceStateMock).not.toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalledWith({
            type: 'SET_GAME_PHASE',
            payload: GamePhase.SPAWN_PREVIEW,
        });
    });

    it('should serialize SPAWN_PREVIEW to the clean spawnpreview slug', () => {
        const { rerender } = renderHook(({ state }) => useHistorySync(state, dispatch), {
            initialProps: { state: gameState },
        });
        replaceStateMock.mockClear();
        mockLocation.search = '?phase=main_menu';

        const newState = { ...gameState, phase: GamePhase.SPAWN_PREVIEW };
        rerender({ state: newState });

        expect(pushStateMock).toHaveBeenCalledWith(
            { phase: GamePhase.SPAWN_PREVIEW },
            '',
            '/?phase=spawnpreview',
        );
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

        // WHAT CHANGED: Notification expectation changed from .toHaveBeenCalled to .not.toHaveBeenCalled.
        // WHY IT CHANGED: Initial deep links use a 'silent guard'. The navigation 
        // is still blocked (security/state integrity), but the UI doesn't 
        // scream at the user with an alert during the millisecond where 
        // the app is still loading its initial session data.
        expect(dispatch).not.toHaveBeenCalledWith({ type: 'SET_GAME_PHASE', payload: GamePhase.PLAYING });
        expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({
            type: 'ADD_NOTIFICATION'
        }));
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

    it('should NOT expose player position (x/y/loc) in the URL when playing', () => {
        const playingState = {
            ...gameState,
            phase: GamePhase.PLAYING,
            currentLocationId: 'loc_1',
        };

        renderHook(() => useHistorySync(playingState, dispatch));

        // Only the phase is written; position stays out of the URL entirely.
        expect(replaceStateMock).toHaveBeenCalledWith(
            { phase: GamePhase.PLAYING },
            '',
            '/?phase=playing'
        );
        const url = replaceStateMock.mock.calls[0][2] as string;
        expect(url).not.toMatch(/x=|y=|loc=/);
    });

    it('should strip stale x/y/loc params on the next state->URL sync', () => {
        // Old bookmarked URL still carrying legacy coordinates while on the menu.
        mockLocation.search = '?phase=main_menu&x=10&y=20&loc=loc_1';
        const { rerender } = renderHook(({ state }) => useHistorySync(state, dispatch), {
            initialProps: { state: gameState }
        });

        // Phase change drives a state->URL sync, which drops the legacy coords.
        const playingState = { ...gameState, phase: GamePhase.PLAYING };
        rerender({ state: playingState });

        expect(pushStateMock).toHaveBeenCalledWith(
            { phase: GamePhase.PLAYING },
            '',
            '/?phase=playing'
        );
        const url = pushStateMock.mock.calls.at(-1)![2] as string;
        expect(url).not.toMatch(/x=|y=|loc=/);
    });

    it('should NOT dispatch MOVE_PLAYER when deep-linking into PLAYING with legacy coords', () => {
        mockLocation.search = '?phase=playing&x=5&y=5&loc=loc_1';
        gameState.party = [{ id: 'p1', name: 'Test', class: { name: 'Fighter' } } as any];

        renderHook(() => useHistorySync(gameState, dispatch));

        // Phase still resolves from the URL...
        expect(dispatch).toHaveBeenCalledWith({
            type: 'SET_GAME_PHASE',
            payload: GamePhase.PLAYING
        });
        // ...but position is no longer restored from the URL.
        expect(dispatch).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'MOVE_PLAYER' })
        );
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

    it('replaces the 404 entry when returning to the main menu', () => {
        mockLocation.search = '?phase=not_found';
        gameState = { ...gameState, phase: GamePhase.NOT_FOUND };
        const { rerender } = renderHook(({ state }) => useHistorySync(state, dispatch), {
            initialProps: { state: gameState },
        });
        replaceStateMock.mockClear();
        pushStateMock.mockClear();
        rerender({ state: { ...gameState, phase: GamePhase.MAIN_MENU } });
        expect(replaceStateMock).toHaveBeenCalledWith({ phase: GamePhase.MAIN_MENU }, '', '/?phase=main_menu');
        expect(pushStateMock).not.toHaveBeenCalled();
    });
});
