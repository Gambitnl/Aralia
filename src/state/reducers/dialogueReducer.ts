
/**
 * @file src/state/reducers/dialogueReducer.ts
 * Reducer for handling dialogue session state.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import { DialogueSession } from '../../types/dialogue';

export function dialogueReducer(state: GameState, action: AppAction): Partial<GameState> {
  switch (action.type) {
    case 'START_DIALOGUE': {
      // Initialize a new dialogue session
      const npcId = action.payload.npcId;
      const initialSession: DialogueSession = {
        npcId: npcId,
        availableTopicIds: [], // Populated by component logic or subsequent action
        discussedTopicIds: [],
        sessionDispositionMod: 0
      };

      return {
        activeDialogueSession: initialSession,
        isDialoguePaneVisible: true,
        // Close other potential overlays
        isMapVisible: false,
        isSubmapVisible: false,
        isDevMenuVisible: false,
        characterSheetModal: { isOpen: false, character: null }
      };
    }

    case 'UPDATE_DIALOGUE_STATE': {
      return {
        activeDialogueSession: action.payload.session
      };
    }

    case 'END_DIALOGUE': {
      return {
        activeDialogueSession: null,
        isDialoguePaneVisible: false,
        lastNpcResponse: null
      };
    }

    default:
      return {};
  }
}
