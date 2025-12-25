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
import { processDailyUpkeep } from '../../services/strongholdService';

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
      const ritualUpdates = ritualReducer({ ...state, gameTime: newTime }, action);
      if (ritualUpdates.activeRitual) {
          partialUpdate.activeRitual = ritualUpdates.activeRitual;
      }
      if (ritualUpdates.messages) {
          currentMessages = ritualUpdates.messages;
      }

      // Process Underdark Mechanics
      const { underdark: newUnderdark, messages: underdarkMessages } = UnderdarkMechanics.processTime(state, action.payload.seconds);

      partialUpdate.underdark = newUnderdark;
      if (underdarkMessages.length > 0) {
          currentMessages = [...currentMessages, ...underdarkMessages];
          partialUpdate.messages = currentMessages;
      }

      if (daysPassed > 0) {
          // 1. Process World Events (Factions, Rumors)
          const { state: newState, logs } = processWorldEvents({ ...state, gameTime: newTime }, daysPassed);

          let updatedStrongholds = state.strongholds || {};
          const strongholdLogs: string[] = [];

          // 2. Process Stronghold Upkeep
          if (state.strongholds) {
              Object.values(state.strongholds).forEach(stronghold => {
                  const { updatedStronghold, summary } = processDailyUpkeep(stronghold);
                  updatedStrongholds = {
                      ...updatedStrongholds,
                      [stronghold.id]: updatedStronghold
                  };

                  // Add summary logs
                  if (summary.goldChange !== 0) strongholdLogs.push(`${stronghold.name}: Gold change ${summary.goldChange > 0 ? '+' : ''}${summary.goldChange}`);
                  summary.threatEvents.forEach(e => strongholdLogs.push(`${stronghold.name}: ${e}`));
                  summary.missionEvents.forEach(e => strongholdLogs.push(`${stronghold.name}: ${e}`));
                  summary.staffEvents.forEach(e => strongholdLogs.push(`${stronghold.name}: ${e}`));
                  summary.alerts.forEach(e => strongholdLogs.push(`${stronghold.name}: ${e}`));
              });
          }

          // Merge all updates
          partialUpdate = {
              ...partialUpdate,
              factions: newState.factions,
              playerFactionStandings: newState.playerFactionStandings,
              strongholds: updatedStrongholds,
              messages: [
                  ...currentMessages,
                  ...logs,
                  ...strongholdLogs.map(text => ({
                      id: crypto.randomUUID(),
                      text,
                      type: 'system' as const,
                      timestamp: newTime.getTime()
                  }))
              ]
          };
      } else {
        // Just update messages if no day passed
        partialUpdate.messages = currentMessages;
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
