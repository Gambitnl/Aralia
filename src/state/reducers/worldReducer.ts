/**
 * @file src/state/reducers/worldReducer.ts
 * A slice reducer that handles world-related state changes.
 */
// TODO(lint-intent): 'DiscoveryResidue' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { GameState, DiscoveryResidue as _DiscoveryResidue, Location as _Location, Faction as _Faction } from '../../types';
import { AppAction } from '../actionTypes';
import { processWorldEvents } from '../../systems/world/WorldEventManager';
import { UnderdarkMechanics } from '../../systems/underdark/UnderdarkMechanics';
import { getGameDay } from '../../utils/timeUtils';
import { ritualReducer } from './ritualReducer';
import { addHistoryEvent, createEmptyHistory } from '../../utils/historyUtils';

export function worldReducer(state: GameState, action: AppAction): Partial<GameState> {
  switch (action.type) {
    case 'SET_MAP_DATA': {
      const mapDataPayload = (action as Extract<AppAction, { type: 'SET_MAP_DATA' }>).payload;
      const mapPayload = mapDataPayload as { width?: number; height?: number } | null;
      // TODO(2026-01-03 pass 4 Codex-CLI): minimapFocus computed from width/height placeholder; replace when map payload is typed.
      const minimapFocus = mapPayload
        ? { x: Math.floor((mapPayload.width || 0) / 2), y: Math.floor((mapPayload.height || 0) / 2) }
        : (state as unknown as { minimapFocus?: unknown }).minimapFocus;
      return { mapData: mapDataPayload, minimapFocus } as Partial<GameState>;
    }

    case 'UPDATE_INSPECTED_TILE_DESCRIPTION': {
      const tilePayload = (action as Extract<AppAction, { type: 'UPDATE_INSPECTED_TILE_DESCRIPTION' }>).payload as { tileKey?: string; description?: string };
      return {
        inspectedTileDescriptions: {
          ...state.inspectedTileDescriptions,
          // TODO(2026-01-03 pass 4 Codex-CLI): tile description payload typing placeholder until action payload is formalized.
          [tilePayload.tileKey ?? 'unknown_tile']: tilePayload.description ?? '',
        },
      };
    }

    case 'SET_LAST_NPC_INTERACTION':
      return {
        lastInteractedNpcId: (action.payload as { npcId: string | null }).npcId,
        lastNpcResponse: (action.payload as { response: string | null }).response,
      };

    case 'RESET_NPC_INTERACTION_CONTEXT':
      return {
        lastInteractedNpcId: null,
        lastNpcResponse: null,
      };

    case 'SET_GEMINI_ACTIONS':
      return { geminiGeneratedActions: action.payload as GameState['geminiGeneratedActions'] };

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

    case 'ADD_WORLD_HISTORY_EVENT': {
      const currentHistory = state.worldHistory || createEmptyHistory();
      const updatedHistory = addHistoryEvent(currentHistory, action.payload.event);
      return {
        worldHistory: updatedHistory
      };
    }

    default:
      return {};
  }
}
