/**
 * @file src/state/reducers/dialogueReducer.ts
 * Reducer for managing the active dialogue session state.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 21:15:45
 * Dependents: state/appState.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import { DialogueSession } from '../../types/dialogue';

export function dialogueReducer(state: GameState, action: AppAction): Partial<GameState> {
    switch (action.type) {
        case 'START_DIALOGUE_SESSION': {
            const { npcId, contactStatus } = action.payload;
            const session: DialogueSession = {
                npcId,
                discussedTopicIds: [],
                // Preserve the pre-contact decision through topic updates and saves.
                ...(contactStatus ? { contactStatus } : {})
            };

            return {
                activeDialogueSession: session,
                isDialogueInterfaceOpen: true
            };
        }

        case 'UPDATE_DIALOGUE_SESSION': {
            const { session } = action.payload;
            return {
                activeDialogueSession: session
            };
        }

        case 'END_DIALOGUE_SESSION': {
            return {
                activeDialogueSession: null,
                isDialogueInterfaceOpen: false
            };
        }

        // NOTE: 'DISCUSS_TOPIC' is handled in npcReducer to update both session and memory.
        // We rely on rootReducer to combine them or appState to delegate.
        // However, if we need it here to ensure specific session logic, we can add it.
        // But since npcReducer handles the session update part too, we don't need it here
        // as long as the root reducer applies updates from all reducers.
        // In this codebase, it seems reducers return Partial<GameState> and are merged.
        // So having it in npcReducer is sufficient.

        default:
            return {};
    }
}
