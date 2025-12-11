/**
 * @file src/state/reducers/worldReducer.ts
 * A slice reducer that handles world-related state changes.
 */
import { GameState, DiscoveryResidue } from '../../types';
import { AppAction } from '../actionTypes';
import { addSecondsToDate } from '../../utils/timeUtils';

export function worldReducer(state: GameState, action: AppAction): Partial<GameState> {
  switch (action.type) {
    case 'SET_MAP_DATA': {
      const minimapFocus = action.payload
        ? { x: Math.floor((action.payload as any).width / 2) || 0, y: Math.floor((action.payload as any).height / 2) || 0 }
        : (state as any).minimapFocus;
      return { mapData: action.payload, minimapFocus } as Partial<GameState>;
    }

    case 'UPDATE_INSPECTED_TILE_DESCRIPTION':
      return {
        inspectedTileDescriptions: {
          ...state.inspectedTileDescriptions,
          [action.payload.tileKey]: action.payload.description,
        },
      };

    case 'SET_LAST_NPC_INTERACTION':
      return {
        lastInteractedNpcId: action.payload.npcId,
        lastNpcResponse: action.payload.response,
      };

    case 'RESET_NPC_INTERACTION_CONTEXT':
      return {
        lastInteractedNpcId: null,
        lastNpcResponse: null,
      };
      
    case 'SET_GEMINI_ACTIONS':
        return { geminiGeneratedActions: action.payload };

    case 'ADVANCE_TIME':
      return { gameTime: addSecondsToDate(state.gameTime, action.payload.seconds) };
    
    case 'ADD_MET_NPC': {
      const { npcId } = action.payload;
      if (state.metNpcIds.includes(npcId)) {
        return {}; // Already met, no state change
      }
      return {
        metNpcIds: [...state.metNpcIds, npcId],
      };
    }
    
    case 'ADD_LOCATION_RESIDUE': {
      const { locationId, residue } = action.payload;
      return {
        locationResidues: {
          ...state.locationResidues,
          [locationId]: residue,
        },
      };
    }
    
    case 'REMOVE_LOCATION_RESIDUE': {
      const { locationId } = action.payload;
      const newResidues = { ...state.locationResidues };
      delete newResidues[locationId];
      return {
        locationResidues: newResidues,
      };
    }

    default:
      return {};
  }
}