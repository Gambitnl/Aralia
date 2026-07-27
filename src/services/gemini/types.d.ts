import { Action, EconomyState, GoalUpdatePayload, GroundingChunk, Item, Monster } from "../../types";
import { GenerationConfig, Tool } from "@google/genai";
export interface GeminiMetadata {
    promptSent: string;
    rawResponse: string;
    rateLimitHit?: boolean;
}
export interface StandardizedResult<T> {
    data: T | null;
    error: string | null;
    metadata?: GeminiMetadata;
}
export interface GeminiTextData extends GeminiMetadata {
    text: string;
}
export interface GeminiCustomActionData extends GeminiTextData {
    actions: Action[];
}
export interface GeminiSocialCheckData extends GeminiTextData {
    outcomeText: string;
    dispositionChange: number;
    memoryFactText: string;
    goalUpdate: GoalUpdatePayload | null;
}
export interface GeminiEncounterData extends GeminiMetadata {
    encounter: Monster[];
    sources: GroundingChunk[];
}
export interface GeminiInventoryData extends GeminiMetadata {
    inventory: Item[];
    economy: EconomyState;
}
export interface GeminiHarvestData extends GeminiMetadata {
    items: Item[];
}
/**
 * Extended GenerationConfig to include systemInstruction, which is supported by the SDK
 * but missing from the current @google/genai type definitions.
 */
export interface ExtendedGenerationConfig extends GenerationConfig {
    systemInstruction?: string | {
        parts: {
            text: string;
        }[];
    } | {
        role: string;
        parts: {
            text: string;
        }[];
    };
    tools?: Tool[];
    thinkingConfig?: {
        thinkingBudget: number;
    };
}
