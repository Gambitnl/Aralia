// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/07/2026, 01:22:36
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
 * This hook is the front door for player actions from the exploration interface.
 *
 * It prepares the shared game context, finds the specialised handler for each action,
 * and owns the global loading/error lifecycle around handlers that do not manage that
 * lifecycle themselves. App.tsx calls this hook and passes the resulting processAction
 * function to action-producing controls throughout the game.
 */

// ============================================================================
// Dependencies
// ============================================================================
// These imports provide game state types, authored world context, handler contracts,
// and the shared helpers used to explain the player's action to narrative systems.
// ============================================================================
import React, { useCallback } from 'react';
import { GameState, Action, Location, GeminiLogEntry, DiscoveryType, ACTION_METADATA } from '../types';
import { AppAction } from '../state/actionTypes';
import { LOCATIONS } from '../data/world/locations';
import { NPCS } from '../data/world/npcs';
import { AddMessageFn, PlayPcmAudioFn, GetCurrentLocationFn, GetCurrentNPCsFn, GetTileTooltipTextFn, AddGeminiLogFn, LogDiscoveryFn } from './actions/actionHandlerTypes';
import { getDiegeticPlayerActionMessage } from '../utils/actionUtils';
import { generateGeneralActionContext } from '../utils/contextUtils';

// ============================================================================
// Hook Inputs
// ============================================================================
// App.tsx supplies both the current game state and the services that action handlers
// need. Keeping these inputs explicit lets the specialised handlers remain reusable.
// ============================================================================
interface UseGameActionsProps {
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  playPcmAudio: PlayPcmAudioFn;
  getCurrentLocation: GetCurrentLocationFn;
  getCurrentNPCs: GetCurrentNPCsFn;
  getTileTooltipText: GetTileTooltipTextFn;
}

// ============================================================================
// Player Action Orchestration
// ============================================================================
// This section records discoveries and AI diagnostics, then routes each player action
// through the correct handler while keeping the global interaction gate trustworthy.
// ============================================================================
export function useGameActions({
  gameState,
  dispatch,
  addMessage,
  playPcmAudio,
  getCurrentLocation,
  getCurrentNPCs,
  getTileTooltipText,
}: UseGameActionsProps) {

  // Record each AI request and response in the developer log without making the
  // specialised action handlers depend directly on global state.
  const addGeminiLog = useCallback<AddGeminiLogFn>((functionName, prompt, response) => {
    const logEntry: GeminiLogEntry = {
      timestamp: new Date(),
      functionName,
      prompt,
      response,
    };
    dispatch({ type: 'ADD_GEMINI_LOG_ENTRY', payload: logEntry });
  }, [dispatch]);

  // Add a location to the discovery journal only once. Revisiting an explored place
  // should not inflate the journal or repeatedly increase its unread count.
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

      // Clear an error left by the previous action before starting this action's
      // loading period. SET_ERROR intentionally ends the reducer's current loading
      // state, so reversing these two dispatches would immediately re-enable controls
      // while an asynchronous action is still pending.
      dispatch({ type: 'SET_ERROR', payload: null });

      // Pure interface toggles remain immediate and spinner-free. All other actions
      // close the global interaction gate until their handler completes or fails.
      if (!isUiToggle) {
        dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: "Processing action..." } });
      }

      // Leaving conversation work resets the selected NPC so a later action cannot
      // accidentally inherit dialogue context from the previous interaction.
      if (action.type !== 'talk') {
        if (gameState.lastInteractedNpcId !== null) {
          dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
        }
      }

      const playerCharacter = gameState.party[0];

      // Echo actions that have a player-facing phrasing into the message history.
      const diegeticMessage = getDiegeticPlayerActionMessage(action, NPCS, LOCATIONS, playerCharacter);
      if (diegeticMessage) {
        addMessage(diegeticMessage, 'player');
      }

      let playerContext = 'An adventurer';

      // Prefer the lead party member's authored identity when one is available.
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
        // Await the selected handler so the loading gate covers the complete action,
        // including network-backed narration and other asynchronous game systems.
        const handler = handlers[action.type];
        if (handler) {
          await handler(action);
        } else {
          addMessage(`Action type ${action.type} not recognized.`, 'system');
          dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
          dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
        }
      } catch (err: unknown) {
        // Convert unknown failures into both a player-facing message and reducer error.
        // SET_ERROR also releases loading immediately; the finally block below remains
        // the common success/error exit for actions whose handlers do not self-manage it.
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

  // Action-producing components only need this stable entry point; all supporting
  // context and lifecycle work remains private to the hook.
  return { processAction };
}
