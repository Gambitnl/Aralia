/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/06/2026, 01:10:56
 * Dependents: state/appState.ts
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This reducer manages everything related to characters in the world.
 *
 * It handles party composition (joining/leaving), equipment changes, XP gains,
 * health modifications, and spell preparation. It is the central authority for
 * the character lifecycle.
 *
 * Called by: appState.ts (as part of the root reducer)
 * Depends on: characterUtils for stat calculations, actionTypes for signal definitions
 */
/**
 * @file src/state/reducers/characterReducer.ts
 * A slice reducer that handles character-related state changes (party, inventory, actions).
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
export declare function characterReducer(state: GameState, action: AppAction): Partial<GameState>;
