
/**
 * @file src/hooks/actions/handleNpcInteraction.ts
 * Handles NPC interaction actions like 'talk'.
 */
import React from 'react';
import { GameState, Action, GoalStatus, KnownFact } from '../../types';
import { AppAction } from '../../state/actionTypes';
import * as OllamaTextService from '../../services/ollamaTextService';
import { synthesizeSpeech } from '../../services/ttsService';
import { AddMessageFn, AddGeminiLogFn, PlayPcmAudioFn } from './actionHandlerTypes';
import { NPCS } from '../../constants';
import { resolveAndRegisterEntities } from '../../utils/entityIntegrationUtils';
import { generateNPC, NPCGenerationConfig } from '../../services/npcGenerator';

interface HandleTalkProps {
  action: Action;
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  addGeminiLog: AddGeminiLogFn;
  playPcmAudio: PlayPcmAudioFn;
  playerContext: string;
  generalActionContext: string;
}

export async function handleStartDialogue({
  action,
  gameState,
  dispatch,
  addMessage
}: HandleTalkProps): Promise<void> {
  const { npcId } = action.payload || {};
  if (!npcId) return;

  // Check if NPC exists in static or generated registries
  let npc = NPCS[npcId] || gameState.generatedNpcs?.[npcId];

  // If not found, and ID looks like an ambient one (or we treat unknown as generative opportunity)
  if (!npc) {
    addMessage("Approaching a villager...", "system");
    
    // Generate new NPC
    const config: NPCGenerationConfig = {
      id: npcId,
      role: 'civilian',
      // In future, pull town wealth/biome from gameState to influence race/clothing
    };
    
    const generatedNpc = generateNPC(config);
    npc = generatedNpc;
    
    // Register them permanently
    dispatch({ type: 'REGISTER_GENERATED_NPC', payload: { npc: generatedNpc } });
    
    // Add "Met" fact immediately so they remember you
    const metFact: KnownFact = {
        id: crypto.randomUUID(),
        text: `Met the adventurer.`,
        source: 'direct',
        isPublic: true,
        timestamp: gameState.gameTime.getTime(),
        strength: 3,
        lifespan: 999,
    };
    dispatch({ type: 'ADD_NPC_KNOWN_FACT', payload: { npcId: generatedNpc.id, fact: metFact } });
    dispatch({ type: 'ADD_MET_NPC', payload: { npcId: generatedNpc.id } });
    
    addMessage(`You greet ${generatedNpc.name}, a ${generatedNpc.biography.age}-year-old ${generatedNpc.biography.classId}.`, "system");
  }

  // Now dispatch the actual session start with the guaranteed valid ID
  dispatch({ type: 'START_DIALOGUE_SESSION', payload: { npcId } });
}

export async function handleTalk({
  action,
  gameState,
  dispatch,
  addMessage,
  addGeminiLog,
  playPcmAudio,
  playerContext,
  generalActionContext,
}: HandleTalkProps): Promise<void> {
  const targetId = 'targetId' in action ? (action as any).targetId : undefined;

  if (!targetId) {
    addMessage("Invalid talk target.", "system");
    return;
  }

  const npc = NPCS[targetId];
  if (npc) {
    // Add NPC to met list on first successful interaction
    if (!gameState.metNpcIds.includes(npc.id)) {
        const metFact: KnownFact = {
            id: crypto.randomUUID(),
            text: `Met ${playerContext}.`,
            source: 'direct',
            isPublic: true,
            timestamp: gameState.gameTime.getTime(),
            strength: 3,
            lifespan: 999,
        };
        dispatch({ type: 'ADD_NPC_KNOWN_FACT', payload: { npcId: npc.id, fact: metFact } });
        dispatch({ type: 'ADD_MET_NPC', payload: { npcId: npc.id } });
    }
    
    // 1. Retrieve NPC memory from gameState
    const memory = gameState.npcMemory[npc.id];
    if (!memory) {
      addMessage(`Error: Could not retrieve memory for ${npc.name}.`, "system");
      return;
    }

    // TODO(FEATURES): Add quest-giver hooks so NPCs can offer/advance quests through dialogue outcomes (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).

    // START DIALOGUE SESSION
    // Instead of immediately generating a generic response, we now open the Dialogue Interface.
    // The "Greeting" will be generated dynamically by the Interface or service if needed,
    // or we can generate a preliminary one here.

    // For now, let's keep the initial "Greeting" generation to seed the conversation window with text.

    // 2. Construct the full prompt
    // We no longer manually build the memory string here; we pass the memory object to geminiService.
    const isFollowUp = npc.id === gameState.lastInteractedNpcId;
    let fullPrompt: string;
    if (isFollowUp) {
      fullPrompt = `Player interacts again. Your previous response was: "${gameState.lastNpcResponse || 'None'}".`;
    } else {
      fullPrompt = `Player (${playerContext}) approaches and wants to talk. General context: ${generalActionContext}.`;
    }

    // Add active goals to the prompt since memoryUtils doesn't handle goals yet
    const activeGoals = memory.goals?.filter(g => g.status === GoalStatus.Active);
    if (activeGoals && activeGoals.length > 0) {
        fullPrompt += `\nMy Current Goals: ["${activeGoals.map(g => g.description).join('", "')}"]`;
    }

    fullPrompt += `\n\nYour EXTREMELY BRIEF response (1-2 sentences MAX):`;

    // 3. Call the refactored geminiService function
    const npcMemoryContext = JSON.stringify(memory);
    const npcResponseResult = await OllamaTextService.generateNPCResponse(
      npc.name,
      fullPrompt,
      npcMemoryContext
    );
    
    const promptSent = npcResponseResult.data?.promptSent || npcResponseResult.metadata?.promptSent || 'Unknown prompt';
    const rawResponse = npcResponseResult.data?.rawResponse || npcResponseResult.metadata?.rawResponse || npcResponseResult.error || 'No response';
    
    addGeminiLog('generateNPCResponse', promptSent, rawResponse);
    
    if (npcResponseResult.data?.rateLimitHit || npcResponseResult.metadata?.rateLimitHit) {
      dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
    }

    if (npcResponseResult.data?.text) {
      const responseText = npcResponseResult.data.text;
      addMessage(`${npc.name}: "${responseText}"`, 'npc');

      // [Linker] Ensure entities mentioned by NPC exist
      await resolveAndRegisterEntities(responseText, gameState, dispatch, addGeminiLog);

      dispatch({ type: 'SET_LAST_NPC_INTERACTION', payload: { npcId: npc.id, response: responseText } });
      
      dispatch({ type: 'UPDATE_NPC_INTERACTION_TIMESTAMP', payload: { npcId: npc.id, timestamp: gameState.gameTime.getTime() } });
      dispatch({ type: 'UPDATE_NPC_DISPOSITION', payload: { npcId: npc.id, amount: 1 } });
      
      // Dispatch START_DIALOGUE_SESSION to open the UI
      dispatch({ type: 'START_DIALOGUE_SESSION', payload: { npcId: npc.id } });

      try {
        const ttsResult = await synthesizeSpeech(responseText, npc.voice?.name || 'Kore', gameState.devModelOverride);
        if (ttsResult.rateLimitHit) {
          dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
        }
        if (ttsResult.audioData) {
          await playPcmAudio(ttsResult.audioData);
        } else if (ttsResult.error) {
          throw ttsResult.error;
        }
      } catch {
        addMessage(`(TTS Error: Could not synthesize speech for ${npc.name})`, 'system');
      }
    } else {
      addMessage(`${npc.name} seems unresponsive or an error occurred.`, 'system');
      dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
    }
  } else {
    addMessage(`There is no one named ${targetId} to talk to here.`, 'system');
    dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
  }
  dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
}
