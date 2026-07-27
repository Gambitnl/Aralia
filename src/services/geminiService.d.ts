export { generateText } from './gemini/core';
import { GeminiHarvestData, GeminiInventoryData, GeminiTextData, StandardizedResult } from './gemini/types';
export type { StandardizedResult, GeminiTextData };
import { generateCharacterName as implGenerateCharacterName, generateCustomActions as implGenerateCustomActions, generateEncounter as implGenerateEncounter, generateOracleResponse as implGenerateOracleResponse, generateSocialCheckOutcome as implGenerateSocialCheckOutcome } from './gemini/encounters';
import { GoalStatus, NPCMemory, EconomyState } from '../types';
export declare function generateLocationDescription(locationName: string, context: string, devModelOverride?: string | null): Promise<StandardizedResult<GeminiTextData>>;
export declare function generateWildernessLocationDescription(biomeName: string, worldMapCoords: {
    x: number;
    y: number;
}, subMapCoords: {
    x: number;
    y: number;
}, playerContext: string, worldMapTileTooltip?: string | null, devModelOverride?: string | null): Promise<StandardizedResult<GeminiTextData>>;
export declare function generateNPCResponse(npcName: string, playerAction: string, npcContext: string, devModelOverride?: string | null): Promise<StandardizedResult<GeminiTextData>>;
export declare function generateActionOutcome(actionDescription: string, context: string, devModelOverride?: string | null): Promise<StandardizedResult<GeminiTextData>>;
export declare function generateDynamicEvent(context: string, devModelOverride?: string | null): Promise<StandardizedResult<GeminiTextData>>;
export declare const generateOracleResponse: typeof implGenerateOracleResponse;
export declare const generateCharacterName: typeof implGenerateCharacterName;
export declare const generateEncounter: typeof implGenerateEncounter;
export declare const generateCustomActions: typeof implGenerateCustomActions;
export declare const generateSocialCheckOutcome: typeof implGenerateSocialCheckOutcome;
export declare function rephraseFactForGossip(fact: string, npcName: string, npcPersonality: string, devModelOverride?: string | null): Promise<StandardizedResult<GeminiTextData>>;
export declare function generateSituationAnalysis(context: string, devModelOverride?: string | null): Promise<StandardizedResult<GeminiTextData>>;
export declare function generateMerchantInventory(shopType: string, context: string, economyState: EconomyState, devModelOverride?: string | null, seedKey?: string): Promise<StandardizedResult<GeminiInventoryData>>;
export declare function generateHarvestLoot(locationName: string, actionDescription: string, devModelOverride?: string | null): Promise<StandardizedResult<GeminiHarvestData>>;
export declare function generateGuideResponse(memory: NPCMemory, goalStatus: GoalStatus, playerContext: string, devModelOverride?: string | null): Promise<StandardizedResult<GeminiTextData>>;
