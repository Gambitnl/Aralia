/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/06/2026, 13:17:11
 * Dependents: state/appState.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/state/reducers/gameEntryReducer.ts
 *
 * Slice reducer for the opening-situation entry state machine. Owns the
 * `gameEntry` field of GameState and translates entry actions through the pure
 * {@link gameEntryTransition} machine so the transitions stay testable.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
export declare function gameEntryReducer(state: GameState, action: AppAction): Partial<GameState>;
