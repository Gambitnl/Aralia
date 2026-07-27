/**
 * @file src/state/reducers/encounterReducer.ts
 * A slice reducer that handles encounter-related state changes.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
export declare function encounterReducer(state: GameState, action: AppAction): Partial<GameState>;
