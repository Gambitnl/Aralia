
/**
 * @file src/hooks/actions/handleOracle.ts
 * Handles 'ask_oracle' actions.
 */
import React from 'react';
import { GameState, Action, GoalStatus, KnownFact } from '../../types';
import { AppAction } from '../../state/actionTypes';
import * as OllamaTextService from '../../services/ollamaTextService';
import * as GeminiService from '../../services/geminiService';
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

    // The Oracle's response can now also trigger goal updates if the information
    // it provides is directly relevant to an NPC's objective.
    // TODO(lint-intent): Oracle responses should use a dedicated generator; for now reuse social outcome with a generic prompt.
    const oracleResponseResult = await GeminiService.generateSocialCheckOutcome(
        null,
        null,
        `oracle response: ${playerQuery} | context: ${generalActionContext}`,
        gameState.devModelOverride ?? null,
    );

    addGeminiLog('generateSocialCheckOutcome (oracle)', oracleResponseResult.data?.promptSent || oracleResponseResult.metadata?.promptSent || "", oracleResponseResult.data?.rawResponse || oracleResponseResult.metadata?.rawResponse || oracleResponseResult.error || "");
    
    if (oracleResponseResult.data?.rateLimitHit || oracleResponseResult.metadata?.rateLimitHit) {
      dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
    }
    
    if (oracleResponseResult.data?.text) {
      const responseText = oracleResponseResult.data.text;
      addMessage(`Oracle: "${responseText}"`, 'system');
      
      if (oracleResponseResult.data.goalUpdate) {
        const { npcId, goalId, newStatus } = oracleResponseResult.data.goalUpdate;
        dispatch({ type: 'UPDATE_NPC_GOAL_STATUS', payload: { npcId, goalId, newStatus }});
        
        const goalFact: KnownFact = {
            id: crypto.randomUUID(),
            text: oracleResponseResult.data.memoryFactText, 
            source: 'direct', 
            isPublic: true,    
            timestamp: gameState.gameTime.getTime(),
            strength: 10,      
            lifespan: 9999,
        };
        dispatch({ type: 'ADD_NPC_KNOWN_FACT', payload: { npcId, fact: goalFact } });

        const dispositionBoost = newStatus === GoalStatus.Completed ? 50 : -50;
        dispatch({ type: 'UPDATE_NPC_DISPOSITION', payload: { npcId, amount: dispositionBoost }});
        addMessage(`This information seems vital! An NPC's goal has been updated to: ${newStatus}. Their disposition towards you changes dramatically.`, 'system');
      }

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
      } catch {
        addMessage(`(TTS Error: Could not synthesize speech for Oracle)`, 'system');
      }
    } else {
      addMessage("The Oracle remains silent, or an error prevented their response.", 'system');
    }
  } else {
    addMessage('You ponder, but ask nothing of the Oracle.', 'system');
  }
  dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
  dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
}
