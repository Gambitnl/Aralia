/**
 * @file src/state/reducers/dialogueReducer.ts
 * Reducer for managing the active dialogue session state.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
export declare function dialogueReducer(state: GameState, action: AppAction): Partial<GameState>;
