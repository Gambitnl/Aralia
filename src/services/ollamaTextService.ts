/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file ollamaTextService.ts
 * Ollama-based text generation service to replace Gemini functions.
 * Provides local AI-powered narrative generation for the RPG.
 */

import { getDefaultClient } from './ollama/client';
import type { OllamaResult } from './ollama';

// Types matching Gemini service interface
export interface OllamaTextData {
  text: string;
  promptSent?: string;
  rawResponse?: string;
  rateLimitHit?: boolean;
}

export interface StandardizedResult<T> {
  success: boolean;
  data?: T | null;
  error?: string | null;
  metadata?: {
    promptSent: string;
    rawResponse: string;
    rateLimitHit?: boolean;
  };
}

// Types are defined above

/**
 * Generate text using Ollama with standardized error handling.
 */
async function generateText(
  prompt: string,
  systemInstruction: string | undefined,
  functionName: string,
  temperature: number = 0.7,
  maxTokens: number = 256
): Promise<StandardizedResult<OllamaTextData>> {
  try {
    const client = getDefaultClient();
    const model = await client.getModel();

    if (!model) {
      return {
        success: false,
        error: 'No Ollama model available',
        metadata: {
          promptSent: prompt,
          rawResponse: 'No Ollama model available',
          rateLimitHit: false
        }
      };
    }

    // Combine system instruction with prompt if provided
    const fullPrompt = systemInstruction
      ? `${systemInstruction}\n\n${prompt}`
      : prompt;

    const result = await client.generate({
      model,
      prompt: fullPrompt,
      temperature,
      numPredict: maxTokens
    });

    if (!result.ok) {
      return {
        success: false,
        error: (result as any).error,
        data: null,
        metadata: {
          promptSent: prompt,
          rawResponse: (result as any).error,
          rateLimitHit: false
        }
      };
    }

    return {
      success: true,
      data: {
        text: result.data.response.trim(),
        promptSent: prompt,
        rawResponse: result.data.response
      },
      metadata: {
        promptSent: prompt,
        rawResponse: result.data.response,
        rateLimitHit: false
      }
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error in Ollama text generation',
      data: null,
      metadata: {
        promptSent: prompt,
        rawResponse: error.message || 'Unknown error',
        rateLimitHit: false
      }
    };
  }
}

/**
 * Generate location description using Ollama.
 */
export async function generateLocationDescription(
  locationName: string,
  context: string
): Promise<StandardizedResult<OllamaTextData>> {
  const systemInstruction = "You are the Narrator for Aralia, a high fantasy RPG. Your goal is to ground the player in the scene with evocative, sensory-rich descriptions. Maintain a 'High Fantasy, Immersive, Gritty' tone. Keep descriptions concise (2-3 sentences) but atmospheric.";

  const prompt = `## NARRATIVE TASK
Describe the location "${locationName}" as the player arrives.

## CONTEXT
${context}

## NARRATIVE GUIDELINES
- Tone: High Fantasy, Immersive, Gritty.
- Show, Don't Tell: Use sensory details (smell of rain, sound of distant bells, chill in the air) rather than generic labels.
- Integration: If the Context mentions weather or time, weave it into the description.
- Brevity: Limit response to 2-3 evocative sentences. Avoid flowery filler.`;

  return await generateText(prompt, systemInstruction, 'generateLocationDescription', 0.8, 150);
}

/**
 * Generate wilderness location description using Ollama.
 */
export async function generateWildernessLocationDescription(
  biomeName: string,
  worldMapCoords: { x: number, y: number },
  subMapCoords: { x: number, y: number },
  playerContext: string,
  worldMapTileTooltip?: string | null
): Promise<StandardizedResult<OllamaTextData>> {
  const systemInstruction = "You are the Narrator for Aralia, a high fantasy RPG. Describe the wilderness with 'High Fantasy, Immersive, Gritty' tone. Focus on the immediate environment and sensory details. Keep it concise (2-3 sentences).";

  const prompt = `## WILDERNESS SCENE
- Biome: ${biomeName}
- World Coords: (${worldMapCoords.x}, ${worldMapCoords.y})
- Submap Coords: (${subMapCoords.x}, ${subMapCoords.y})
- Current Tile: ${worldMapTileTooltip || 'No tooltip'}

## PLAYER CONTEXT
${playerContext}

## TASK
Describe the wilderness the player is currently in, focusing on immediate sights, sounds, and smells. Keep it to 2-3 sentences.`;

  return await generateText(prompt, systemInstruction, 'generateWildernessLocationDescription', 0.8, 150);
}

/**
 * Generate NPC response using Ollama.
 */
export async function generateNPCResponse(
  npcName: string,
  playerAction: string,
  npcContext: string
): Promise<StandardizedResult<OllamaTextData>> {
  const systemInstruction = "You are role-playing NPCs in a high fantasy RPG. Your replies should be 1-2 sentences, in the NPC's voice, and react to the player's action and context.";

  const prompt = `NPC: ${npcName}
Player Action: ${playerAction}
NPC Context: ${npcContext}

Respond in-character in 1-2 sentences.`;

  return await generateText(prompt, systemInstruction, 'generateNPCResponse', 0.9, 100);
}

/**
 * Generate action outcome using Ollama.
 */
export async function generateActionOutcome(
  actionDescription: string,
  context: string
): Promise<StandardizedResult<OllamaTextData>> {
  const systemInstruction = "You narrate immediate outcomes of player actions in a high fantasy RPG. Keep it to 1-2 sentences, focusing on vivid but concise description.";

  const prompt = `Action: ${actionDescription}
Context: ${context}
Outcome:`;

  return await generateText(prompt, systemInstruction, 'generateActionOutcome', 0.8, 120);
}

/**
 * Generate dynamic event using Ollama.
 */
export async function generateDynamicEvent(
  context: string
): Promise<StandardizedResult<OllamaTextData>> {
  const systemInstruction = "You generate short, dynamic world events (1-2 sentences) that feel reactive to context.";

  const prompt = `Context: ${context}
Generate a short dynamic event in 1-2 sentences.`;

  return await generateText(prompt, systemInstruction, 'generateDynamicEvent', 0.8, 100);
}

/**
 * Generate oracle response using Ollama.
 */
export async function generateOracleResponse(
  context: string
): Promise<StandardizedResult<OllamaTextData>> {
  const systemInstruction = "You are an oracle providing cryptic but helpful guidance in a high fantasy RPG. Your responses should be 1-2 sentences, mysterious but actionable.";

  const prompt = `Context: ${context}
Provide an oracle's cryptic guidance in 1-2 sentences.`;

  return await generateText(prompt, systemInstruction, 'generateOracleResponse', 0.9, 120);
}

/**
 * Generate character name using Ollama.
 */
export async function generateCharacterName(
  race: string,
  classType: string,
  context?: string
): Promise<StandardizedResult<OllamaTextData>> {
  const systemInstruction = "You generate fitting character names for a high fantasy RPG. Names should feel authentic to the race and class.";

  const prompt = `Generate a single character name for:
Race: ${race}
Class: ${classType}
${context ? `Context: ${context}` : ''}

Provide only the name, nothing else.`;

  return await generateText(prompt, systemInstruction, 'generateCharacterName', 0.7, 50);
}

/**
 * Generate tile inspection details using Ollama.
 */
export async function generateTileInspectionDetails(
  tileDetails: any, // InspectSubmapTilePayload or string
  context: string
): Promise<StandardizedResult<OllamaTextData>> {
  const systemInstruction = "You describe what a player discovers when closely inspecting terrain or objects in a high fantasy RPG. Keep descriptions atmospheric and discovery-focused.";

  // Handle both string and object inputs
  let tileType: string;
  if (typeof tileDetails === 'string') {
    tileType = tileDetails;
  } else {
    // It's an InspectSubmapTilePayload object
    tileType = tileDetails.activeFeatureConfig?.name || tileDetails.activeFeatureConfig?.id || 'unknown feature';
  }

  const prompt = `Tile/Object: ${tileType}
Context: ${context}

Describe what the player discovers upon close inspection in 2-3 sentences.`;

  return await generateText(prompt, systemInstruction, 'generateTileInspectionDetails', 0.8, 150);
}

/**
 * Generate encounter description using Ollama.
 */
export async function generateEncounter(
  context: string,
  difficulty: string = 'medium'
): Promise<StandardizedResult<OllamaTextData>> {
  const systemInstruction = "You generate combat encounters for a high fantasy RPG. Describe the encounter setup vividly but concisely.";

  const prompt = `Context: ${context}
Difficulty: ${difficulty}

Generate a combat encounter description in 2-3 sentences. Include what the player encounters and any immediate tactical considerations.`;

  return await generateText(prompt, systemInstruction, 'generateEncounter', 0.8, 200);
}

/**
 * Generate custom actions using Ollama.
 */
export async function generateCustomActions(
  context: string,
  availableActions: string[]
): Promise<StandardizedResult<OllamaTextData>> {
  const systemInstruction = "You suggest creative actions a player could take in a high fantasy RPG based on the current situation.";

  const prompt = `Context: ${context}
Available Standard Actions: ${availableActions.join(', ')}

Suggest 2-3 creative custom actions the player could take. Each action should be 1 sentence describing what the player does.`;

  return await generateText(prompt, systemInstruction, 'generateCustomActions', 0.9, 200);
}

/**
 * Generate social check outcome using Ollama.
 */
export async function generateSocialCheckOutcome(
  action: string,
  context: string,
  dc: number
): Promise<StandardizedResult<OllamaTextData>> {
  const systemInstruction = "You narrate the outcome of social interactions in a high fantasy RPG. Describe how NPCs react to the player's social attempts.";

  const prompt = `Social Action: ${action}
Context: ${context}
DC: ${dc}

Describe the outcome of this social interaction in 2-3 sentences.`;

  return await generateText(prompt, systemInstruction, 'generateSocialCheckOutcome', 0.8, 150);
}

/**
 * Rephrase fact for gossip using Ollama.
 */
export async function rephraseFactForGossip(
  fact: string,
  npcName: string,
  npcPersonality: string
): Promise<StandardizedResult<OllamaTextData>> {
  const systemInstruction = "You turn plain facts into conversational gossip from the perspective of the named NPC. Keep it to 1-2 sentences, in their voice.";

  const prompt = `NPC: ${npcName}
Personality: ${npcPersonality}
Fact to rephrase: ${fact}

Rephrase this as gossip spoken by ${npcName} in 1-2 sentences.`;

  return await generateText(prompt, systemInstruction, 'rephraseFactForGossip', 0.9, 120);
}

/**
 * Generate situation analysis using Ollama.
 */
export async function generateSituationAnalysis(
  context: string
): Promise<StandardizedResult<OllamaTextData>> {
  const systemInstruction = "You are a DM hint system. In 1-2 sentences, suggest what the player could consider doing next based on context. Be concise, no spoilers.";

  const prompt = `Context: ${context}

Provide a brief situational analysis and one suggested next action.`;

  return await generateText(prompt, systemInstruction, 'generateSituationAnalysis', 0.7, 100);
}

/**
 * Generate harvest loot using Ollama.
 */
export async function generateHarvestLoot(
  locationName: string,
  actionDescription: string
): Promise<StandardizedResult<OllamaTextData>> {
  const systemInstruction = "You describe what a player finds when harvesting/gathering resources in a high fantasy RPG. Include both mundane and potentially valuable items.";

  const prompt = `Location: ${locationName}
Action: ${actionDescription}

Describe what the player harvests or finds in 2-3 sentences. Include specific items found and their condition.`;

  return await generateText(prompt, systemInstruction, 'generateHarvestLoot', 0.8, 150);
}

/**
 * Generate guide response using Ollama.
 */
export async function generateGuideResponse(
  memory: any, // NPCMemory or string
  goalStatus: string,
  playerContext: string
): Promise<StandardizedResult<OllamaTextData>> {
  const systemInstruction = "You are an NPC guide providing helpful information and direction in a high fantasy RPG. Your responses should be helpful but not spoil the adventure.";

  // Convert memory to string if it's an object
  const memoryStr = typeof memory === 'string' ? memory : JSON.stringify(memory);

  const prompt = `Guide's Memory: ${memoryStr}
Goal Status: ${goalStatus}
Player Context: ${playerContext}

Provide guidance as an NPC mentor in 2-3 sentences.`;

  return await generateText(prompt, systemInstruction, 'generateGuideResponse', 0.8, 150);
}