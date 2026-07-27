/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/07/2026, 13:10:48
 * Dependents: state/appState.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/state/reducers/npcReducer.ts
 * A slice reducer that handles NPC memory state changes.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
export declare function npcReducer(state: GameState, action: AppAction): Partial<GameState>;
