/**
 * @file src/state/reducers/economyReducer.ts
 * Slice reducer for player-initiated economy actions:
 * investments, loans, speculation, and business management.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
export declare function economyReducer(state: GameState, action: AppAction): Partial<GameState>;
