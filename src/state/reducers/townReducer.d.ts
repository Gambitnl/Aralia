/**
 * @file src/state/reducers/townReducer.ts
 * Reducer for the temple modal (village temple UI).
 *
 * Formerly also handled the legacy 2D town-exploration state (player movement,
 * entering/exiting towns, viewport). That 2D village view was retired in the
 * grid-retirement program (slices 1a/1b); this reducer now handles only the
 * still-live OPEN_TEMPLE / CLOSE_TEMPLE actions.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
/**
 * Handle temple-related actions and return partial state updates
 */
export declare function townReducer(state: GameState, action: AppAction): Partial<GameState>;
