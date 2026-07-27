/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 18:13:07
 * Dependents: App.tsx
 * Imports: 52 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/state/appState.ts
 * Defines the state structure, initial state, actions, and the root reducer for the application.
 * The root reducer orchestrates calls to smaller "slice" reducers for better modularity.
 */
import { GameState } from '../types';
import { AppAction } from './actionTypes';
import { initialGameState, INITIAL_DIVINE_FAVOR } from './initialState';
export { initialGameState, INITIAL_DIVINE_FAVOR };
export declare function appReducer(state: GameState, action: AppAction): GameState;
