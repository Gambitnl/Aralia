/**
 * @file src/state/GameContext.tsx
 * Provides access to the global game state for components that are not directly
 * managed by App.tsx or need deep access without prop drilling.
 *
 * NOTE: Prefer passing props for simple component hierarchies. Use this only when
 * prop drilling becomes unmanageable or for cross-cutting concerns (like Economy).
 */
import React, { createContext, useContext } from 'react';
import { GameState } from '../types';
import { AppAction } from './actionTypes';

interface GameContextType {
    state: GameState;
    dispatch: React.Dispatch<AppAction>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ state: GameState, dispatch: React.Dispatch<AppAction>, children: React.ReactNode }> = ({ state, dispatch, children }) => {
    return (
        <GameContext.Provider value={{ state, dispatch }}>
            {children}
        </GameContext.Provider>
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
