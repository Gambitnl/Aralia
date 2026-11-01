/**
 * @file src/state/useGameSelector.ts
 * Subscribe to one slice of the game state (C6, agora-9ed9.6).
 *
 * useGameState returns a new { state, dispatch } object on every dispatch, so a
 * component that reads it re-renders whenever anything changes. useGameSelector
 * reads the stable GameStore instead, through useSyncExternalStore, and
 * re-renders only when the selected value changes under `isEqual`.
 *
 * The saving applies to components their parent does not already re-render,
 * for example React.memo components or children of memoized subtrees. Existing
 * useGameState consumers are unchanged; migrate them one at a time and measure.
 */
import { useContext, useRef, useSyncExternalStore } from 'react';
import type { GameState } from '../types';
import { GameStoreContext } from './GameContext';

export function useGameSelector<T>(
    selector: (state: GameState) => T,
    isEqual: (previous: T, next: T) => boolean = Object.is,
): T {
    const store = useContext(GameStoreContext);
    if (!store) {
        throw new Error('useGameSelector must be used within a GameProvider');
    }

    // Cache by state AND selector: an inline selector with new closure values
    // must recompute even when the state object is unchanged.
    const cache = useRef<{ state: GameState; selector: (state: GameState) => T; selected: T } | null>(null);
    const getSnapshot = (): T => {
        const state = store.getState();
        const previous = cache.current;
        if (previous && previous.state === state && previous.selector === selector) {
            return previous.selected;
        }
        const next = selector(state);
        if (previous && isEqual(previous.selected, next)) {
            cache.current = { state, selector, selected: previous.selected };
            return previous.selected;
        }
        cache.current = { state, selector, selected: next };
        return next;
    };

    return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

/** Shallow equality for selected objects and arrays of primitive fields. */
export function shallowEqual<T>(previous: T, next: T): boolean {
    if (Object.is(previous, next)) return true;
    if (typeof previous !== 'object' || typeof next !== 'object' || previous === null || next === null) return false;
    const previousKeys = Object.keys(previous as object);
    const nextKeys = Object.keys(next as object);
    if (previousKeys.length !== nextKeys.length) return false;
    return previousKeys.every((key) => Object.is(
        (previous as Record<string, unknown>)[key],
        (next as Record<string, unknown>)[key],
    ));
}
