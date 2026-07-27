/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 19/07/2026, 08:31:00
 * Dependents: App.tsx, state/appState.ts
 * Imports: 15 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/state/initialState.ts
 * Defines the initial state for the application.
 * Unified source of truth for the starting GameState.
 */
import { GameState } from '../types';
import type { DivineFavor } from '../types/religion';
export declare const INITIAL_DIVINE_FAVOR: Record<string, DivineFavor>;
export declare const initialGameState: GameState;
