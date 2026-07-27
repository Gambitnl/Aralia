/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 08:32:04
 * Dependents: state/appState.ts
 * Imports: 28 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/state/reducers/worldReducer.ts
 * A slice reducer that handles world-related state changes.
 */
import { GameState } from "../../types";
import { AppAction } from "../actionTypes";
export declare const resolveBiomeId: (state: GameState) => string;
export declare function worldReducer(state: GameState, action: AppAction): Partial<GameState>;
