
/**
 * @file src/hooks/actions/handleObservation.ts
 * Handles observation actions like 'look_around' and 'analyze_situation'.
 */
import React from 'react';
import { GameState, MapTile } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { biomeIdForCell } from '../../systems/worldforge/local/biomeForCell';
import * as OllamaTextService from '../../services/ollamaTextService';
import * as GeminiService from '../../services/geminiService';
import { AddMessageFn, AddGeminiLogFn, GetTileTooltipTextFn } from './actionHandlerTypes';
import { DIRECTION_VECTORS } from '../../config/mapConfig';
import { resolveAndRegisterEntities } from '../../utils/entityIntegrationUtils';
import { isWildernessLocationId } from '../../utils/location/cellLocationId';

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
  // Grid retirement: the "look around" tile flavor comes from the player's
  // canonical cell biome (cell-native world), synthesized into a tile shape for
  // the existing tooltip formatter — NOT a read of the legacy 30x20 mapData.tiles.
  if (gameState.playerCell?.cellId != null && isWildernessLocationId(gameState.currentLocationId)) {
    // Grid retirement: x,y are display bookkeeping — a legacy coord_X_Y id keeps
    // its coords; a cell_<id> id labels by cell id.
    const legacy = /^coord_(\d+)_(\d+)$/.exec(gameState.currentLocationId);
    const worldX = legacy ? Number(legacy[1]) : gameState.playerCell.cellId;
    const worldY = legacy ? Number(legacy[2]) : 0;
    const biomeId = biomeIdForCell(gameState.worldSeed ?? 0, gameState.playerCell.cellId);
    const synthTile = { x: worldX, y: worldY, biomeId, discovered: true, isPlayerCurrent: true } as MapTile;
    worldMapTileTooltipForGemini = getTileTooltipText(synthTile);
  }

  const lookContext = `${generalActionContext}${worldMapTileTooltipForGemini ? ` | Tile: ${worldMapTileTooltipForGemini}` : ''}`;
  const lookDescResult = await OllamaTextService.generateActionOutcome(
    'Player looks around the area.',
    lookContext
  );

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
        const labelLower = (action.label || '').toLowerCase();
        const promptLower = (action.payload as { geminiPrompt?: string } | undefined)?.geminiPrompt?.toLowerCase() || "";
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
  const analysisResult = await OllamaTextService.generateSituationAnalysis(generalActionContext);

  addGeminiLog('generateSituationAnalysis', analysisResult.data?.promptSent || analysisResult.metadata?.promptSent || "", analysisResult.data?.rawResponse || analysisResult.metadata?.rawResponse || analysisResult.error || "");

  if (analysisResult.data?.rateLimitHit || analysisResult.metadata?.rateLimitHit) {
    dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
  }

  if (analysisResult.data?.text) {
    addMessage(`DM Insight: ${analysisResult.data.text}`, 'system');
    // We don't resolve entities from Analysis - it's meta-game advice.
  } else {
    addMessage("The spirits are silent.", 'system');
  }

  dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
  dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
}
