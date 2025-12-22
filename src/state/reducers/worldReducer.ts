/**
 * @file src/state/reducers/worldReducer.ts
 * A slice reducer that handles world-related state changes.
 */
import { GameState, DiscoveryResidue, Location, Faction } from '../../types';
import { AppAction } from '../actionTypes';
import { processWorldEvents } from '../../systems/world/WorldEventManager';
import { UnderdarkMechanics } from '../../systems/underdark/UnderdarkMechanics';
import { getGameDay } from '../../utils/timeUtils';
import { ritualReducer } from './ritualReducer';

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

    case 'ADVANCE_TIME': {
      const oldTime = state.gameTime;
      const newTime = new Date(oldTime.getTime());
      newTime.setSeconds(newTime.getSeconds() + action.payload.seconds);

      // Check if a day has passed
      const oldDay = getGameDay(oldTime);
      const newDay = getGameDay(newTime);
      const daysPassed = newDay - oldDay;

      let partialUpdate: Partial<GameState> = { gameTime: newTime };
      let currentMessages = state.messages;

      // RITUALIST: Delegate ritual advancement to ritualReducer
      // We pass the new time to the ritualReducer via state, but ritualReducer mostly cares about minutes passed
      // which it can calculate from payload if we pass the action, OR we just let it handle ADVANCE_TIME directly.
      // Since worldReducer is handling ADVANCE_TIME, we can call ritualReducer with the same action.
      const ritualUpdates = ritualReducer({ ...state, gameTime: newTime }, action);
      if (ritualUpdates.activeRitual) {
          partialUpdate.activeRitual = ritualUpdates.activeRitual;
      }
      if (ritualUpdates.messages) {
          // If ritualReducer added messages, append them.
          // Note: ritualReducer.ts returns the *new full list* of messages based on state.messages.
          // So we should use that list, but we also have other updates pending (Underdark).
          // We need to be careful about merging message arrays.

          // Strategy: Calculate ritual messages diff or just trust the latest list if we chain updates.
          // Simpler: Let's extract the *new* messages from ritualReducer if possible, or just use its result as the base
          // for the next step.
          currentMessages = ritualUpdates.messages;
      }

      // Process Underdark Mechanics (Light/Sanity)
      // We pass the potentially modified state so it has the latest time, but other state properties (like Underdark)
      // are taken from 'state' and updated in the returned object.
      const { underdark: newUnderdark, messages: underdarkMessages } = UnderdarkMechanics.processTime(state, action.payload.seconds);

      partialUpdate.underdark = newUnderdark;
      if (underdarkMessages.length > 0) {
          currentMessages = [...currentMessages, ...underdarkMessages];
          partialUpdate.messages = currentMessages;
      }

      if (daysPassed > 0) {
          // Note: processWorldEvents expects the full state, so we ideally merge our partial updates first
          // But since processWorldEvents mostly cares about factions/history, passing state with just updated time is OK for now.
          const { state: newState, logs } = processWorldEvents({ ...state, gameTime: newTime }, daysPassed);

          // Merge world event changes
          partialUpdate = {
              ...partialUpdate,
              factions: newState.factions,
              playerFactionStandings: newState.playerFactionStandings,
              messages: [...currentMessages, ...logs] // Append logs to whatever we already had
          };
      }

      return partialUpdate;
    }
    
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

    case 'REGISTER_DYNAMIC_ENTITY': {
      // Discriminated union handling without ts-ignore
      if (action.payload.entityType === 'location') {
        return {
          dynamicLocations: {
            ...state.dynamicLocations,
            [action.payload.entity.id]: action.payload.entity
          }
        };
      } else if (action.payload.entityType === 'faction') {
        return {
          factions: {
            ...state.factions,
            [action.payload.entity.id]: action.payload.entity
          }
        };
      } else if (action.payload.entityType === 'npc') {
        return {
          dynamicNPCs: {
            ...(state.dynamicNPCs || {}),
            [action.payload.entity.id]: action.payload.entity
          }
        };
      }
      return {};
    }

    default:
      return {};
  }
}
