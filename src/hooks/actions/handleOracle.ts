// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:28:19
 * Dependents: actionHandlers.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/hooks/actions/handleOracle.ts
 * Handles 'ask_oracle' actions.
 */
import React from 'react';
import { GameState, Action } from '../../types';
import { AppAction } from '../../state/actionTypes';
import * as OllamaTextService from '../../services/ollamaTextService';
import { buildOraclePrompt } from '../../systems/adventureLog/oraclePrompt';
import { synthesizeSpeech } from '../../services/ttsService';
import { AddMessageFn, AddGeminiLogFn, PlayPcmAudioFn } from './actionHandlerTypes';

interface HandleOracleProps {
  action: Action;
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  addGeminiLog: AddGeminiLogFn;
  playPcmAudio: PlayPcmAudioFn;
  generalActionContext: string;
}

export async function handleOracle({
  action,
  gameState,
  dispatch,
  addMessage,
  addGeminiLog,
  playPcmAudio,
  generalActionContext,
}: HandleOracleProps): Promise<void> {
  const payload = (action as any).payload;
  if (payload?.query) {
    const playerQuery = payload.query as string;
    addMessage(`You approach the Oracle and ask: "${playerQuery}"`, 'player');
    dispatch({ type: 'ADVANCE_TIME', payload: { seconds: 3600 } });

    // The Oracle IS the Dungeon Master: build a grounded prompt from the runtime
    // adventure log (story so far), active quests, the current town, and the
    // people/places the party actually knows, then route it through the SAME
    // local-model path the opening scene uses (ollamaTextService). No Gemini key
    // is required. An honest error surfaces only when the model is unreachable.
    void generalActionContext; // superseded by the grounded Oracle prompt below.
    const oraclePrompt = buildOraclePrompt(gameState, playerQuery);
    const oracleResponseResult = await OllamaTextService.generateOracleDmResponse(oraclePrompt);

    addGeminiLog(
      'generateOracleDmResponse (oracle)',
      oracleResponseResult.data?.promptSent || oracleResponseResult.metadata?.promptSent || oraclePrompt,
      oracleResponseResult.data?.rawResponse || oracleResponseResult.metadata?.rawResponse || oracleResponseResult.error || '',
    );

    if (oracleResponseResult.data?.rateLimitHit || oracleResponseResult.metadata?.rateLimitHit) {
      dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
    }

    if (oracleResponseResult.data?.text) {
      const responseText = oracleResponseResult.data.text;
      addMessage(`Oracle: "${responseText}"`, 'system');

      try {
        const ttsResult = await synthesizeSpeech(responseText, 'Charon', gameState.devModelOverride);
        if (ttsResult.rateLimitHit) {
          dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
        }
        if (ttsResult.audioData) {
          await playPcmAudio(ttsResult.audioData);
        } else if (ttsResult.error) {
          throw ttsResult.error;
        }
      } catch (err) {
        // TTS is a nice-to-have: never leak its failures into the game log.
        console.warn('[TTS] Could not synthesize speech for Oracle:', err);
      }
    } else {
      // Honest failure: only reached when the local model is genuinely
      // unreachable / returned nothing. Surface the real reason so the player
      // (and logs) know it's an infrastructure issue, not narrative silence.
      const reason = oracleResponseResult.error || 'the Oracle could not be reached';
      addMessage(`The Oracle remains silent — ${reason}.`, 'system');
    }
  } else {
    addMessage('You ponder, but ask nothing of the Oracle.', 'system');
  }
  dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
  dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
}
