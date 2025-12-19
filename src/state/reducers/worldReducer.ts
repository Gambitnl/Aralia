/**
 * @file src/state/reducers/worldReducer.ts
 * A slice reducer that handles world-related state changes.
 */
import { GameState, DiscoveryResidue, Location, Faction } from '../../types';
import { AppAction } from '../actionTypes';
import { processWorldEvents } from '../../systems/world/WorldEventManager';
import { checkDeadlines } from '../../systems/time/DeadlineManager';
import { getGameDay } from '../../utils/timeUtils';

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
      let newMessages = [...state.messages];

      // 1. Process Deadlines (Always, even if < 1 day passed)
      if (state.deadlines && state.deadlines.length > 0) {
        const { deadlines, logs, actions } = checkDeadlines({ ...state, gameTime: newTime }, newTime);
        partialUpdate = {
            ...partialUpdate,
            deadlines
        };
        newMessages = [...newMessages, ...logs];

        // Handle consequence actions
        if (actions.length > 0) {
            // Apply Quest Failures
            const questFailActions = actions.filter(a => a.payload?.type === 'FAIL_QUEST');
            if (questFailActions.length > 0) {
                const questIdsToFail = questFailActions.map(a => a.payload?.questId as string);

                // We need to update the questLog in partialUpdate (or merge with existing)
                // Note: state.questLog might be modified by processWorldEvents later if we don't handle order correctly.
                // But simplified:
                const currentQuestLog = partialUpdate.questLog || state.questLog;

                partialUpdate.questLog = currentQuestLog.map(q => {
                    if (questIdsToFail.includes(q.id)) {
                        return { ...q, status: 'Failed' as any, dateCompleted: newTime.getTime() };
                    }
                    return q;
                });
            }
        }
      }

      // 2. Process World Events (Daily)
      if (daysPassed > 0) {
          // Note: we pass the potentially modified 'partialUpdate' merged with state?
          // No, processWorldEvents takes the WHOLE state.
          // We should ideally chain these, but for now let's pass the base state with the new time
          // and then merge the results.
          // If deadline logic changed factions (via consequences), we might miss it here if we don't chain.
          // For now, assuming deadline consequences are mostly messages or quest updates (handled elsewhere/TODO).

          const { state: newState, logs } = processWorldEvents({ ...state, gameTime: newTime }, daysPassed);

          // Merge world event changes
          partialUpdate = {
              ...partialUpdate,
              factions: newState.factions,
              playerFactionStandings: newState.playerFactionStandings,
          };
          newMessages = [...newMessages, ...logs];
      }

      partialUpdate.messages = newMessages;

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
      const { entityType, entity } = action.payload as { entityType: 'location' | 'faction', entity: Location | Faction };
      if (entityType === 'location') {
        const loc = entity as Location;
        return {
          dynamicLocations: {
            ...state.dynamicLocations,
            [loc.id]: loc
          }
        };
      } else if (entityType === 'faction') {
        const fac = entity as Faction;
        return {
          factions: {
            ...state.factions,
            [fac.id]: fac
          }
        };
      }
      return {};
    }

    default:
      return {};
  }
}
