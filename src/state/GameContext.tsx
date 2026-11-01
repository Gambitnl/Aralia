/**
 * @file src/state/GameContext.tsx
 * Provides access to the global game state for components that are not directly
 * managed by App.tsx or need deep access without prop drilling.
 *
 * NOTE: Prefer passing props for simple component hierarchies. Use this only when
 * prop drilling becomes unmanageable or for cross-cutting concerns (like Economy).
 */
import React, { createContext, useContext, useLayoutEffect, useState } from 'react';
import { GameState } from '../types';
import { AppAction } from './actionTypes';

interface GameContextType {
    state: GameState;
    dispatch: React.Dispatch<AppAction>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

/**
 * A stable handle on the latest game state, for useGameSelector (C6,
 * agora-9ed9.6). Its identity never changes, so subscribers re-render only when
 * the slice they select changes, not on every dispatch. useGameState and its
 * { state, dispatch } context value are unchanged for existing consumers.
 */
export interface GameStore {
    getState: () => GameState;
    subscribe: (listener: () => void) => () => void;
    dispatch: React.Dispatch<AppAction>;
}

export const GameStoreContext = createContext<GameStore | undefined>(undefined);

interface GameStoreHolder {
    store: GameStore;
    /** Makes committed state visible to the store and notifies subscribers. */
    publish: (state: GameState, dispatch: React.Dispatch<AppAction>) => void;
}

function createGameStoreHolder(state: GameState, dispatch: React.Dispatch<AppAction>): GameStoreHolder {
    // Private to this holder: only publish() changes them, and GameProvider
    // calls publish() at commit (GG-439).
    let committedState = state;
    let committedDispatch = dispatch;
    const listeners = new Set<() => void>();
    return {
        store: {
            getState: () => committedState,
            subscribe: (listener) => {
                listeners.add(listener);
                return () => { listeners.delete(listener); };
            },
            dispatch: (action) => committedDispatch(action),
        },
        publish: (nextState, nextDispatch) => {
            committedDispatch = nextDispatch;
            if (nextState === committedState) return;
            committedState = nextState;
            listeners.forEach((listener) => listener());
        },
    };
}

export const GameProvider: React.FC<{ state: GameState, dispatch: React.Dispatch<AppAction>, children: React.ReactNode }> = ({ state, dispatch, children }) => {
    // The initializer runs once, so the holder (and the store identity that
    // consumers subscribe to) is stable without reading a ref during render.
    const [holder] = useState(() => createGameStoreHolder(state, dispatch));
    // GG-439: publish at commit only. Copying state during render let a
    // suspended or interrupted render that React later abandons hand its
    // never-shown state to store subscribers. A consumer that renders in the
    // same pass as this provider reads the previous committed state first;
    // useSyncExternalStore sees the change on notify and re-renders it
    // synchronously, before paint, so the screen never shows the old value.
    useLayoutEffect(() => {
        holder.publish(state, dispatch);
    }, [holder, state, dispatch]);

    return (
        <GameStoreContext.Provider value={holder.store}>
            <GameContext.Provider value={{ state, dispatch }}>
                {children}
            </GameContext.Provider>
        </GameStoreContext.Provider>
    );
};

export const useGameState = () => {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGameState must be used within a GameProvider');     
    }
    return context;
};

// Optional accessor for callers (e.g., tests) that can operate without a mounted provider.
export const useOptionalGameState = () => useContext(GameContext);
