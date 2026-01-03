import { FAST_MODEL } from '../config/geminiConfig';
export { generateText } from './gemini/core';
import { generateText } from './gemini/core';
import { GeminiHarvestData, GeminiInventoryData, GeminiTextData, StandardizedResult } from './gemini/types';

export type { StandardizedResult, GeminiTextData };
import { generateCharacterName as implGenerateCharacterName, generateCustomActions as implGenerateCustomActions, generateEncounter as implGenerateEncounter, generateOracleResponse as implGenerateOracleResponse, generateSocialCheckOutcome as implGenerateSocialCheckOutcome, generateTileInspectionDetails as implGenerateTileInspectionDetails } from './gemini/encounters';
import { generateGuideResponse as implGenerateGuideResponse, generateHarvestLoot as implGenerateHarvestLoot, generateMerchantInventory as implGenerateMerchantInventory } from './gemini/items';
import { GoalStatus, NPCMemory, EconomyState } from '../types';

export async function generateLocationDescription(
  locationName: string,
  context: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiTextData>> {
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

  return await generateText(prompt, systemInstruction, false, 'generateLocationDescription', devModelOverride, FAST_MODEL);
}

export async function generateWildernessLocationDescription(
  biomeName: string,
  worldMapCoords: { x: number, y: number },
  subMapCoords: { x: number, y: number },
  playerContext: string,
  worldMapTileTooltip?: string | null,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiTextData>> {
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

  return await generateText(prompt, systemInstruction, false, 'generateWildernessLocationDescription', devModelOverride, FAST_MODEL);
}

export async function generateNPCResponse(
  npcName: string,
  playerAction: string,
  npcContext: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiTextData>> {
  const systemInstruction = "You are role-playing NPCs in a high fantasy RPG. Your replies should be 1-2 sentences, in the NPC's voice, and react to the player's action and context.";

  const prompt = `NPC: ${npcName}
Player Action: ${playerAction}
NPC Context: ${npcContext}

Respond in-character in 1-2 sentences.`;

  return await generateText(prompt, systemInstruction, false, 'generateNPCResponse', devModelOverride, FAST_MODEL);
}

export async function generateActionOutcome(
  actionDescription: string,
  context: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiTextData>> {
  const systemInstruction = "You narrate immediate outcomes of player actions in a high fantasy RPG. Keep it to 1-2 sentences, focusing on vivid but concise description.";

  const prompt = `Action: ${actionDescription}
Context: ${context}
Outcome:`;

  return await generateText(prompt, systemInstruction, false, 'generateActionOutcome', devModelOverride, FAST_MODEL);
}

export async function generateDynamicEvent(
  context: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiTextData>> {
  const systemInstruction = "You generate short, dynamic world events (1-2 sentences) that feel reactive to context.";

  const prompt = `Context: ${context}
Generate a short dynamic event in 1-2 sentences.`;

  return await generateText(prompt, systemInstruction, false, 'generateDynamicEvent', devModelOverride, FAST_MODEL);
}

// Facades to keep API surface unchanged for existing imports
export const generateOracleResponse = generateOracleResponseFacade;
export const generateCharacterName = generateCharacterNameFacade;
export const generateTileInspectionDetails = generateTileInspectionDetailsFacade;
export const generateEncounter = generateEncounterFacade;
export const generateCustomActions = generateCustomActionsFacade;
export const generateSocialCheckOutcome = generateSocialCheckOutcomeFacade;

export async function rephraseFactForGossip(
  fact: string,
  npcName: string,
  npcPersonality: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiTextData>> {
  const systemInstruction = "You turn plain facts into conversational gossip from the perspective of the named NPC. Keep it to 1-2 sentences, in their voice.";
  const prompt = `NPC: ${npcName}
Personality: ${npcPersonality}
Fact to rephrase: ${fact}

Rephrase this as gossip spoken by ${npcName} in 1-2 sentences.`;
  return generateText(prompt, systemInstruction, false, 'rephraseFactForGossip', devModelOverride, FAST_MODEL);
}

export async function generateSituationAnalysis(
  context: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiTextData>> {
  const systemInstruction = "You are a DM hint system. In 1-2 sentences, suggest what the player could consider doing next based on context. Be concise, no spoilers.";
  const prompt = `Context: ${context}

Provide a brief situational analysis and one suggested next action.`;
  return generateText(prompt, systemInstruction, false, 'generateSituationAnalysis', devModelOverride, FAST_MODEL);
}

export async function generateMerchantInventory(
  shopType: string,
  context: string,
  economyState: EconomyState,
  devModelOverride: string | null = null,
  seedKey?: string
): Promise<StandardizedResult<GeminiInventoryData>> {
  return implGenerateMerchantInventory(shopType, context, economyState, devModelOverride, seedKey);
}

export async function generateHarvestLoot(
  locationName: string,
  actionDescription: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiHarvestData>> {
  return implGenerateHarvestLoot(locationName, actionDescription, devModelOverride);
}

export async function generateGuideResponse(
  memory: NPCMemory,
  goalStatus: GoalStatus,
  playerContext: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiTextData>> {
  return implGenerateGuideResponse(memory, goalStatus, playerContext, devModelOverride);
}

// Internal facades
import {
  generateOracleResponse as generateOracleResponseFacade,
  generateCharacterName as generateCharacterNameFacade,
  generateTileInspectionDetails as generateTileInspectionDetailsFacade,
  generateEncounter as generateEncounterFacade,
  generateCustomActions as generateCustomActionsFacade,
  generateSocialCheckOutcome as generateSocialCheckOutcomeFacade,
} from './gemini/encounters';
