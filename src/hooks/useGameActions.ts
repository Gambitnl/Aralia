// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/06/2026, 13:13:23
 * Dependents: App.tsx
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
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
import { LOCATIONS } from '../data/world/locations';
import { NPCS } from '../data/world/npcs';
import { AddMessageFn, PlayPcmAudioFn, GetCurrentLocationFn, GetCurrentNPCsFn, GetTileTooltipTextFn, AddGeminiLogFn, LogDiscoveryFn } from './actions/actionHandlerTypes';
import { getDiegeticPlayerActionMessage } from '../utils/actionUtils';
import { generateGeneralActionContext } from '../utils/contextUtils';


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
        }
      });
    }
  }, [gameState.discoveryLog, gameState.gameTime, dispatch]);

  const processAction = useCallback(
    async (action: Action) => {
      // RALPH: UI Toggle Gate.
      // ACTION_METADATA is the single source for global loading policy. Keeping
      // loading exceptions here explicit makes new action types fail visibly
      // instead of being hidden by string suffix checks.
      const actionMetadata = ACTION_METADATA[action.type];
      const isUiToggle = Boolean(actionMetadata?.isUiToggle);
      if (!isUiToggle) {
        dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: "Processing action..." } });
      }

      dispatch({ type: 'SET_ERROR', payload: null });

      if (action.type !== 'talk') {
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

      // Load the full action registry only once a player action actually needs it.
      // That registry imports encounter, item, spell, and merchant handlers, so
      // keeping it out of the startup path protects the main menu from gameplay data.
      const { buildActionHandlers } = await import('./actions/actionHandlers');

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
        // Clear loading state if it was set initially. Actions marked with
        // `managesLoading` own their own lifecycle and should not be reset here.
        const handledByComponent = Boolean(actionMetadata?.managesLoading);

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
