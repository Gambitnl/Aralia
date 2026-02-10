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
import { getGameDay } from '../../utils/core';
import { ritualReducer } from './ritualReducer';
import { addHistoryEvent, createEmptyHistory } from '../../utils/historyUtils';
import { processAllStrongholds, strongholdSummariesToMessages } from '../../services/strongholdService';

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
      // RALPH: The Chronos Loop.
      // Advancing time isn't just updating a clock; it triggers a chain reaction:
      // 1. Ritual Progression: Some spells tick down per second.
      // 2. Underdark Survival: Sanity/Light levels decay.
      // 3. World Events: If a day passes, Factions gain power and Trade Routes fluctuate.
      const oldTime = state.gameTime;
      const newTime = new Date(oldTime.getTime());
      newTime.setSeconds(newTime.getSeconds() + action.payload.seconds);

      // Normalize rest tracking in case older states omitted the tracker.
      const currentRestTracker = state.shortRestTracker ?? {
        restsTakenToday: 0,
        lastRestDay: getGameDay(oldTime),
        lastRestEndedAtMs: null,
      };

      // Check if a day has passed
      const oldDay = getGameDay(oldTime);
      const newDay = getGameDay(newTime);
      const daysPassed = newDay - oldDay;

      // RALPH: Pipeline Logic.
      // We start with a base update (the time itself) and then pass it through sub-handlers.
      let nextState: GameState = { ...state, gameTime: newTime };

      // 1. Ritual Advancement
      // We apply the ritualReducer directly to our accumulating nextState.
      nextState = { ...nextState, ...ritualReducer(nextState, action) };

      // 2. Underdark Mechanics
      // Processes light decay and sanity.
      const { underdark: newUnderdark, messages: underdarkMessages } = UnderdarkMechanics.processTime(nextState, action.payload.seconds);
      nextState = { 
        ...nextState, 
        underdark: newUnderdark,
        messages: [...nextState.messages, ...underdarkMessages]
      };

      // 3. Daily World Simulation
      if (daysPassed > 0) {
        // Reset daily short rest counts when the in-game day ticks over.
        if (newDay !== currentRestTracker.lastRestDay) {
          nextState = {
            ...nextState,
            shortRestTracker: {
                ...currentRestTracker,
                restsTakenToday: 0,
                lastRestDay: newDay,
            }
          };
        }
        
        const { state: simulatedWorldState, logs: worldLogs } = processWorldEvents(nextState, daysPassed);

        // Merge world event changes (Factions, Economy, standigs) and append logs.
        nextState = {
          ...nextState,
          factions: simulatedWorldState.factions,
          playerFactionStandings: simulatedWorldState.playerFactionStandings,
          messages: [...nextState.messages, ...worldLogs]
        };

        // 4. Stronghold Daily Processing
        if (nextState.strongholds && Object.keys(nextState.strongholds).length > 0) {
          const { updatedStrongholds, summaries } = processAllStrongholds(nextState.strongholds);
          const strongholdMessages = strongholdSummariesToMessages(summaries, newTime);
          nextState = {
            ...nextState,
            strongholds: updatedStrongholds,
            messages: [...nextState.messages, ...strongholdMessages]
          };
        }
      }

      // Return ONLY the fields that changed to satisfy the slice reducer contract
      // Actually, since we produced a full state, we could return it all, 
      // but Partial<GameState> is expected.
      return nextState;
    }

    case 'SHORT_REST': {
      const restPayload = action.payload as { shortRestTracker?: GameState['shortRestTracker'] } | undefined;
      // Update party-level rest pacing if the handler supplied it.
      return restPayload?.shortRestTracker
        ? { shortRestTracker: restPayload.shortRestTracker }
        : {};
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
