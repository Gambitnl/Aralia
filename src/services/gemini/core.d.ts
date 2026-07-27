import { GeminiTextData, StandardizedResult } from "./types";
/**
 * Calculates exponential backoff delay for retries.
 * @param attemptNumber The current retry attempt (0-indexed)
 * @returns Delay in milliseconds
 */
export declare function calculateBackoffDelay(attemptNumber: number): number;
/**
 * Utility to wait for a specified duration.
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Selects an appropriate model based on interaction complexity and frequency (spam protection).
 *
 * Rules:
 * 1. Spam Protection: If < 15s since last request, downgrade to FAST_MODEL.
 * 2. Complexity Check: If userInput is provided and < 6 words, downgrade to FAST_MODEL.
 * 3. Default: Use preferredModel.
 *
 * @param preferredModel The model the feature *wants* to use (e.g., COMPLEX_MODEL).
 * @param userInputForComplexityCheck Optional user input string to check for word count.
 * @returns The selected model ID.
 */
export declare function chooseModelForComplexity(preferredModel: string, userInputForComplexityCheck?: string | null): string;
export declare const defaultSystemInstruction = "You are a storyteller for a text-based high fantasy RPG set in a world of dragons, ancient magic, and looming conflict (like Krynn). Your responses MUST be EXTREMELY BRIEF, MAXIMUM 1-2 sentences. Provide ONLY essential 'breadcrumb' details. Focus on atmosphere and key information. NO long descriptions. Be concise.";
/**
 * Generic function to generate text content using the Gemini API.
 * Returns a StandardizedResult containing data on success or an error string on failure.
 *
 * Includes robust rate limiting:
 * - Global cooldown check before making requests
 * - Exponential backoff delays between model fallback attempts
 * - 30s global cooldown after exhausting all models
 */
export declare function generateText(promptContent: string, systemInstruction: string | undefined, expectJson?: boolean, functionName?: string, devModelOverride?: string | null, preferredModel?: string, thinkingBudget?: number): Promise<StandardizedResult<GeminiTextData>>;
