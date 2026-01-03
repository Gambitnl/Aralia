
/**
 * @file src/state/reducers/encounterReducer.ts
 * A slice reducer that handles encounter-related state changes.
 */
import { GameState } from '../../types';
import { AppAction } from '../actionTypes';

export function encounterReducer(state: GameState, action: AppAction): Partial<GameState> {
  switch (action.type) {
    case 'GENERATE_ENCOUNTER':
      return {
        isLoading: true,
        loadingMessage: "The DM is consulting ancient tomes...",
        isEncounterModalVisible: false,
        generatedEncounter: null,
        encounterSources: null,
        encounterError: null,
      };

    case 'SHOW_ENCOUNTER_MODAL': {
      const { encounterData } = action.payload as { encounterData?: import('../../types').ShowEncounterModalPayload };
      return {
        isLoading: false,
        loadingMessage: null,
        isEncounterModalVisible: true,
        generatedEncounter: encounterData?.encounter || null,
        encounterSources: encounterData?.sources || null,
        encounterError: encounterData?.error || null,
        tempParty: encounterData?.partyUsed || state.tempParty, // Update temp party to what was used
      };
    }
    case 'HIDE_ENCOUNTER_MODAL':
      return {
        isEncounterModalVisible: false,
        generatedEncounter: null,
        encounterSources: null,
        encounterError: null,
      };

    default:
      return {};
  }
}
