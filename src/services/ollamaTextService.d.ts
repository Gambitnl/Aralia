/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file ollamaTextService.ts
 * Ollama-based text generation service to replace Gemini functions.
 * Provides local AI-powered narrative generation for the RPG.
 */
import type { ModelParams } from './ollama';
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
/**
 * Generate location description using Ollama.
 */
export declare function generateLocationDescription(locationName: string, context: string): Promise<StandardizedResult<OllamaTextData>>;
/**
 * Generate wilderness location description using Ollama.
 */
export declare function generateWildernessLocationDescription(biomeName: string, worldMapCoords: {
    x: number;
    y: number;
}, subMapCoords: {
    x: number;
    y: number;
}, playerContext: string, worldMapTileTooltip?: string | null): Promise<StandardizedResult<OllamaTextData>>;
/**
 * Generate NPC response using Ollama.
 */
export declare function generateNPCResponse(npcName: string, playerAction: string, npcContext: string): Promise<StandardizedResult<OllamaTextData>>;
/**
 * Generate action outcome using Ollama.
 */
export declare function generateActionOutcome(actionDescription: string, context: string): Promise<StandardizedResult<OllamaTextData>>;
/**
 * Generate dynamic event using Ollama.
 */
export declare function generateDynamicEvent(context: string): Promise<StandardizedResult<OllamaTextData>>;
/**
 * Generate oracle response using Ollama.
 */
export declare function generateOracleResponse(context: string): Promise<StandardizedResult<OllamaTextData>>;
/**
 * Oracle-as-Dungeon-Master response. Takes a fully-formed, grounded prompt
 * (built by src/systems/adventureLog/oraclePrompt.buildOraclePrompt, which
 * already embeds the DM system instruction + the story-so-far briefing) and
 * routes it through the local model. The prompt is passed verbatim so the
 * grounding rules and the "don't invent names" instruction reach the model.
 */
export declare function generateOracleDmResponse(fullPrompt: string, overrides?: ModelParams): Promise<StandardizedResult<OllamaTextData>>;
/**
 * Generate character name using Ollama.
 */
export declare function generateCharacterName(race: string, classType: string, context?: string): Promise<StandardizedResult<OllamaTextData>>;
/**
 * Generate encounter description using Ollama.
 */
export declare function generateEncounter(context: string, difficulty?: string): Promise<StandardizedResult<OllamaTextData>>;
/**
 * Generate custom actions using Ollama.
 */
export declare function generateCustomActions(context: string, availableActions: string[]): Promise<StandardizedResult<OllamaTextData>>;
/**
 * Generate social check outcome using Ollama.
 */
export declare function generateSocialCheckOutcome(action: string, context: string, dc: number): Promise<StandardizedResult<OllamaTextData>>;
/**
 * Rephrase fact for gossip using Ollama.
 */
export declare function rephraseFactForGossip(fact: string, npcName: string, npcPersonality: string): Promise<StandardizedResult<OllamaTextData>>;
/**
 * Generate situation analysis using Ollama.
 */
export declare function generateSituationAnalysis(context: string): Promise<StandardizedResult<OllamaTextData>>;
/**
 * Generate harvest loot using Ollama.
 */
export declare function generateHarvestLoot(locationName: string, actionDescription: string): Promise<StandardizedResult<OllamaTextData>>;
/**
 * Generate guide response using Ollama.
 */
export declare function generateGuideResponse(memory: any, // NPCMemory or string
goalStatus: string, playerContext: string): Promise<StandardizedResult<OllamaTextData>>;
