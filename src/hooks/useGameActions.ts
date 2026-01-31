// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 31/01/2026, 17:14:14
 * Dependents: App.tsx
 * Imports: 7 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/hooks/useGameActions.ts
 * Custom hook for managing game action processing.
 * This is the refactored version that orchestrates calls to specific action handlers.
 */
import React, { useCallback } from 'react';
import { GameState, Action, Location, GeminiLogEntry, DiscoveryType, ACTION_METADATA } from '../types';
import { AppAction } from '../state/actionTypes';
import { LOCATIONS, NPCS } from '../constants';
import { AddMessageFn, PlayPcmAudioFn, GetCurrentLocationFn, GetCurrentNPCsFn, GetTileTooltipTextFn, AddGeminiLogFn, LogDiscoveryFn } from './actions/actionHandlerTypes';
import { getDiegeticPlayerActionMessage } from '../utils/actionUtils';
import { generateGeneralActionContext } from '../utils/contextUtils';
import { buildActionHandlers } from './actions/actionHandlers';
import { UIToggleAction } from '../types/ui';


interface UseGameActionsProps {
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  playPcmAudio: PlayPcmAudioFn;
  getCurrentLocation: GetCurrentLocationFn;
  getCurrentNPCs: GetCurrentNPCsFn;
  getTileTooltipText: GetTileTooltipTextFn;
}


export function useGameActions({
  gameState,
  dispatch,
  addMessage,
  playPcmAudio,
  getCurrentLocation,
  getCurrentNPCs,
  getTileTooltipText,
}: UseGameActionsProps) {

  const addGeminiLog = useCallback<AddGeminiLogFn>((functionName, prompt, response) => {
    const logEntry: GeminiLogEntry = {
      timestamp: new Date(),
      functionName,
      prompt,
      response,
    };
    dispatch({ type: 'ADD_GEMINI_LOG_ENTRY', payload: logEntry });
  }, [dispatch]);

  const logDiscovery = useCallback<LogDiscoveryFn>((newLocation: Location) => {
    const alreadyDiscovered = gameState.discoveryLog.some(entry =>
      entry.type === DiscoveryType.LOCATION_DISCOVERY &&
      entry.flags.some(f => f.key === 'locationId' && f.value === newLocation.id)
    );

    if (!alreadyDiscovered) {
      dispatch({
        type: 'ADD_DISCOVERY_ENTRY',
        payload: {
          gameTime: gameState.gameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
          type: DiscoveryType.LOCATION_DISCOVERY,
          title: `Location Discovered: ${newLocation.name}`,
          content: `You have discovered ${newLocation.name}. ${newLocation.baseDescription}`,
          source: { type: 'LOCATION', id: newLocation.id, name: newLocation.name },
          flags: [{ key: 'locationId', value: newLocation.id, label: newLocation.name }],
          isQuestRelated: false,
          associatedLocationId: newLocation.id,
          worldMapCoordinates: newLocation.mapCoordinates,
        }
      });
    }
  }, [gameState.discoveryLog, gameState.gameTime, dispatch]);

  const processAction = useCallback(
    async (action: Action) => {
      // RALPH: UI Toggle Gate.
      // Uses the centralized UIToggleAction enum to determine if an action should trigger
      // the global loading spinner. This prevents "Ghost Spinners" during pure UI transitions.
      const isUiToggle = Object.values(UIToggleAction).includes(action.type as any);
      if (!isUiToggle) {
        dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: "Processing action..." } });
      }

      dispatch({ type: 'SET_ERROR', payload: null });

      if (action.type !== 'talk' && action.type !== 'inspect_submap_tile') {
        if (gameState.lastInteractedNpcId !== null) {
          dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
        }
      }

      const playerCharacter = gameState.party[0];

      const diegeticMessage = getDiegeticPlayerActionMessage(action, NPCS, LOCATIONS, playerCharacter);
      if (diegeticMessage) {
        addMessage(diegeticMessage, 'player');
      }

      let playerContext = 'An adventurer';
      if (playerCharacter) {
        playerContext = `${playerCharacter.name}, a ${playerCharacter.race.name} ${playerCharacter.class.name}`;
      }

      const currentLoc = getCurrentLocation();
      const npcsInLocation = getCurrentNPCs();

      // Use the centralized context generator for consistent, rich narrative context
      const generalActionContext = generateGeneralActionContext({
        gameState,
        playerCharacter,
        currentLocation: currentLoc,
        npcsInLocation
      });

      // Build the registry in src/hooks/actions/actionHandlers.ts so this hook
      // stays focused on orchestration and lifecycle management.
      const handlers = buildActionHandlers({
        gameState,
        dispatch,
        addMessage,
        playPcmAudio,
        getCurrentLocation,
        getCurrentNPCs,
        getTileTooltipText,
        addGeminiLog,
        logDiscovery,
        playerCharacter,
        playerContext,
        generalActionContext,
      });

      // TODO: Wrap handler dispatches in a centralized try/finally that clears loading/error state (Reason: thrown handlers can leave the global spinner stuck; Expectation: UI returns to idle even when an action aborts mid-flow).
      try {
        const handler = handlers[action.type];
        if (handler) {
          await handler(action);
        } else {
          addMessage(`Action type ${action.type} not recognized.`, 'system');
          dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
          dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[useGameActions] Error in ${action.type}:`, err);
        addMessage(`Error processing action: ${msg}`, 'system');
        dispatch({ type: 'SET_ERROR', payload: msg });
        dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
        dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
      } finally {
        // Clear loading state if it was set initially.
        // handlers for complex actions (like save_game or encounter generation) 
        // manage their own loading lifecycle and should not be reset here.
        const handledByComponent = action.type === 'save_game' ||
          action.type === 'GENERATE_ENCOUNTER' ||
          action.type.includes('_MERCHANT') ||
          action.type.includes('_ITEM');

        if (!isUiToggle && !handledByComponent) {
          dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
        }
      }
    },
    [
      gameState, dispatch, addMessage, playPcmAudio, getCurrentLocation, getCurrentNPCs, getTileTooltipText, addGeminiLog, logDiscovery
    ],
  );

  return { processAction };
}
