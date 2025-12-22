
/**
 * @file src/hooks/actions/handleObservation.ts
 * Handles observation actions like 'look_around' and 'inspect_submap_tile'.
 */
import React from 'react';
import { GameState, Action, InspectSubmapTilePayload, UpdateInspectedTileDescriptionPayload } from '../../types';
import { AppAction } from '../../state/actionTypes';
import * as GeminiService from '../../services/geminiService';
import { AddMessageFn, AddGeminiLogFn, GetTileTooltipTextFn } from './actionHandlerTypes';
import { DIRECTION_VECTORS } from '../../config/mapConfig';
import { resolveAndRegisterEntities } from '../../utils/entityIntegrationUtils';

interface HandleLookAroundProps {
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  addGeminiLog: AddGeminiLogFn;
  generalActionContext: string;
  getTileTooltipText: GetTileTooltipTextFn;
}

export async function handleLookAround({
  gameState,
  dispatch,
  addMessage,
  addGeminiLog,
  generalActionContext,
  getTileTooltipText,
}: HandleLookAroundProps): Promise<void> {
  let worldMapTileTooltipForGemini: string | null = null;
  if (gameState.mapData && gameState.currentLocationId.startsWith('coord_')) {
    const parts = gameState.currentLocationId.split('_');
    const worldX = parseInt(parts[1]);
    const worldY = parseInt(parts[2]);
    const tile = gameState.mapData.tiles[worldY]?.[worldX];
    if (tile) {
      worldMapTileTooltipForGemini = getTileTooltipText(tile);
    }
  }

  const lookDescResult = await GeminiService.generateActionOutcome('Player looks around the area.', generalActionContext, false, worldMapTileTooltipForGemini, gameState.devModelOverride);
  
  addGeminiLog('generateActionOutcome (look_around)', lookDescResult.data?.promptSent || lookDescResult.metadata?.promptSent || "", lookDescResult.data?.rawResponse || lookDescResult.metadata?.rawResponse || lookDescResult.error || "");
  
  if (lookDescResult.data?.rateLimitHit || lookDescResult.metadata?.rateLimitHit) {
    dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
  }

  if (lookDescResult.data?.text) {
    const descText = lookDescResult.data.text;
    addMessage(descText, 'system');

    // Linker Coherence Check
    await resolveAndRegisterEntities(descText, gameState, dispatch, addGeminiLog);

    const customActionsResult = await GeminiService.generateCustomActions(descText, generalActionContext, gameState.devModelOverride);
    
    addGeminiLog('generateCustomActions', customActionsResult.data?.promptSent || customActionsResult.metadata?.promptSent || "", customActionsResult.data?.rawResponse || customActionsResult.metadata?.rawResponse || customActionsResult.error || "");
    
    if (customActionsResult.data?.rateLimitHit || customActionsResult.metadata?.rateLimitHit) {
      dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
    }
    
    if (customActionsResult.data?.actions) {
        const existingCompassDirections = Object.keys(DIRECTION_VECTORS);
        const filteredActions = customActionsResult.data.actions.filter(action => {
            const labelLower = action.label.toLowerCase();
            const promptLower = action.payload?.geminiPrompt?.toLowerCase() || "";
            return !existingCompassDirections.some(dir =>
                labelLower.includes(dir.toLowerCase()) || promptLower.includes(dir.toLowerCase())
            );
        });
        dispatch({ type: 'SET_GEMINI_ACTIONS', payload: filteredActions.length > 0 ? filteredActions : null });
    } else {
        // If actions failed to generate, just clear custom actions
        dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
    }

  } else {
    addMessage("You look around, but nothing new catches your eye.", 'system');
    dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
  }
  dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
}

interface HandleInspectSubmapTileProps {
  action: Action;
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  addGeminiLog: AddGeminiLogFn;
  generalActionContext: string;
}

export async function handleInspectSubmapTile({
  action,
  gameState,
  dispatch,
  addMessage,
  addGeminiLog,
  generalActionContext,
}: HandleInspectSubmapTileProps): Promise<void> {
  if (!action.payload?.inspectTileDetails) {
    addMessage("Cannot inspect tile: missing details.", "system");
    return;
  }
  const { inspectTileDetails } = action.payload;

  const inspectionResult = await GeminiService.generateTileInspectionDetails(
    inspectTileDetails as InspectSubmapTilePayload,
    generalActionContext,
    gameState.devModelOverride,
  );
  
  addGeminiLog('generateTileInspectionDetails', inspectionResult.data?.promptSent || inspectionResult.metadata?.promptSent || "", inspectionResult.data?.rawResponse || inspectionResult.metadata?.rawResponse || inspectionResult.error || "");
  
  if (inspectionResult.data?.rateLimitHit || inspectionResult.metadata?.rateLimitHit) {
    dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
  }

  if (inspectionResult.data?.text) {
    addMessage(inspectionResult.data.text, "system");

    // Linker Coherence Check
    await resolveAndRegisterEntities(inspectionResult.data.text, gameState, dispatch, addGeminiLog);

    const tileKey = `${inspectTileDetails.parentWorldMapCoords.x}_${inspectTileDetails.parentWorldMapCoords.y}_${inspectTileDetails.tileX}_${inspectTileDetails.tileY}`;
    const updatePayload: UpdateInspectedTileDescriptionPayload = {
      tileKey,
      description: inspectionResult.data.text,
    };
    dispatch({ type: 'UPDATE_INSPECTED_TILE_DESCRIPTION', payload: updatePayload });
  } else {
    addMessage("Your inspection reveals nothing new or an error occurred.", "system");
  }

  dispatch({ type: 'ADVANCE_TIME', payload: { seconds: 300 } });
  dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
  dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
}

interface HandleAnalyzeSituationProps {
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
    addMessage: AddMessageFn;
    addGeminiLog: AddGeminiLogFn;
    generalActionContext: string;
}

export async function handleAnalyzeSituation({
    gameState,
    dispatch,
    addMessage,
    addGeminiLog,
    generalActionContext
}: HandleAnalyzeSituationProps): Promise<void> {
    const analysisResult = await GeminiService.generateSituationAnalysis(generalActionContext, gameState.devModelOverride);
    
    addGeminiLog('generateSituationAnalysis', analysisResult.data?.promptSent || analysisResult.metadata?.promptSent || "", analysisResult.data?.rawResponse || analysisResult.metadata?.rawResponse || analysisResult.error || "");
    
    if (analysisResult.data?.rateLimitHit || analysisResult.metadata?.rateLimitHit) {
        dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
    }

    if (analysisResult.data?.text) {
        addMessage(`DM Insight: "${analysisResult.data.text}"`, 'system');
        // We don't resolve entities from Analysis - it's meta-game advice.
    } else {
        addMessage("The spirits are silent.", 'system');
    }
    
    dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
    dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
}
