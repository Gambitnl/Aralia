/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 05/04/2026, 00:55:31
 * Dependents: state/reducers/worldReducer.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/state/reducers/ritualReducer.ts
 * Reducer logic for managing ritual progress inside the shared game state.
 *
 * The ritual manager now stores canonical progress in seconds so world-time and
 * combat-time can share the same scalar. This reducer translates incoming time
 * actions into seconds, feeds them into the ritual manager, and keeps the older
 * display-facing ritual fields flowing through state for unfinished UI surfaces.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
export declare function ritualReducer(state: GameState, action: AppAction): Partial<GameState>;
