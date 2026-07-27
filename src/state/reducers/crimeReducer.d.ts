/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/06/2026, 07:55:29
 * Dependents: state/appState.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
/**
 * Handles crime and notoriety related actions.
 */
export declare const crimeReducer: (state: GameState, action: AppAction) => Partial<GameState>;
