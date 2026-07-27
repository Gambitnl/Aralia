import type { Dispatch } from 'react';
import { GameState } from '../types';
import { AppAction } from '../state/actionTypes';
export declare function useDungeonRumorsSync(gameState: GameState, dispatch: Dispatch<AppAction>): void;
