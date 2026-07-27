/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 07:25:51
 * Dependents: state/appState.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/state/reducers/journalReducer.ts
 * Reducer for managing journal state including entries, events, and sessions.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
/**
 * Reducer for journal-related actions.
 */
export declare function journalReducer(state: GameState, action: AppAction): Partial<GameState>;
