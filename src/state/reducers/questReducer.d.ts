/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 02:06:39
 * Dependents: state/appState.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/state/reducers/questReducer.ts
 * Reducer for managing quest state.
 *
 * Quest state machine (all transitions are idempotent and safe to re-run):
 *  - Pending/unknown quests become Active when ACCEPT_QUEST is dispatched.
 *  - Active quests move to Completed automatically when every objective is
 *    marked complete, or explicitly via COMPLETE_QUEST.
 *  - Failed status is preserved if external systems ever flag it, and
 *    objective updates will not resurrect a failed quest.
 *  - Accepted, completed, and failed transitions also queue matching journal
 *    events so the quest log and the journal can stay in sync later.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
export declare function questReducer(state: GameState, action: AppAction): Partial<GameState>;
