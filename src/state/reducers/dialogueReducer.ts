/**
 * @file src/state/reducers/dialogueReducer.ts
 * Reducer for managing the active dialogue session state.
 */

import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import { DialogueSession } from '../../types/dialogue';

export function dialogueReducer(state: GameState, action: AppAction): Partial<GameState> {
    switch (action.type) {
        case 'START_DIALOGUE_SESSION': {
            const { npcId } = action.payload;
            const session: DialogueSession = {
                npcId,
                availableTopicIds: [], // Will be populated by UI or Service on init
                discussedTopicIds: [],
                sessionDispositionMod: 0
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

        default:
            return {};
    }
}
