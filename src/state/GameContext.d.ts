/**
 * @file src/state/GameContext.tsx
 * Provides access to the global game state for components that are not directly
 * managed by App.tsx or need deep access without prop drilling.
 *
 * NOTE: Prefer passing props for simple component hierarchies. Use this only when
 * prop drilling becomes unmanageable or for cross-cutting concerns (like Economy).
 */
import React from 'react';
import { GameState } from '../types';
import { AppAction } from './actionTypes';
interface GameContextType {
    state: GameState;
    dispatch: React.Dispatch<AppAction>;
}
export declare const GameProvider: React.FC<{
    state: GameState;
    dispatch: React.Dispatch<AppAction>;
    children: React.ReactNode;
}>;
export declare const useGameState: () => GameContextType;
export declare const useOptionalGameState: () => GameContextType;
export {};
