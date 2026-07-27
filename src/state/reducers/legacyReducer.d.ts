/**
 * @file src/state/reducers/legacyReducer.ts
 * Reducer for handling Legacy and Stronghold actions.
 */
import { GameState } from '../../types/index';
import { AppAction } from '../actionTypes';
export declare function legacyReducer(state: GameState, action: AppAction): Partial<GameState>;
