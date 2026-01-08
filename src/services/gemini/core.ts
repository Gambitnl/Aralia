import { GenerateContentResponse, GenerationConfig } from "@google/genai";
import { ai, isAiEnabled } from "../aiClient";
import { withRetry } from "../../utils/networkUtils";
import { logger } from "../../utils/logger";
import { sanitizeAIInput, redactSensitiveData } from "../../utils/securityUtils";
import { FAST_MODEL, GEMINI_TEXT_MODEL_FALLBACK_CHAIN } from "../../config/geminiConfig";
import { ExtendedGenerationConfig, GeminiTextData, StandardizedResult } from "./types";

const API_TIMEOUT_MS = 20000; // 20 seconds

// --- Adaptive Rate Limiting State ---
// TODO: The `lastRequestTimestamp` is the single source of truth for adaptive throttling.
// However, `generateEncounter` in encounters.ts does NOT update this timestamp after its API calls.
// This can cause drift: encounter generation doesn't reset the timer, so subsequent calls (e.g., NPC chat)
// might incorrectly think enough time has passed. Consider refactoring to ensure ALL API calls
// funnel through a single timestamp-updating pathway, or have encounters.ts call a shared updater.
let lastRequestTimestamp = 0;
let globalCooldownUntil = 0; // Timestamp when cooldown ends (0 = no cooldown)

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  BASE_RETRY_DELAY_MS: 1000,      // Initial delay between model fallbacks
  MAX_RETRY_DELAY_MS: 8000,       // Maximum delay between retries
  GLOBAL_COOLDOWN_MS: 30000,      // 30 second cooldown after exhausting all models
  COOLDOWN_MULTIPLIER: 1.5,       // Multiplier for exponential backoff
};

/**
 * Checks if we're currently in a global rate limit cooldown period.
 * Returns remaining cooldown time in ms, or 0 if no cooldown.
 */
function getRemainingCooldown(): number {
  const now = Date.now();
  if (globalCooldownUntil > now) {
    return globalCooldownUntil - now;
  }
  return 0;
}

/**
 * Activates a global cooldown period after exhausting all model fallbacks.
 */
function activateGlobalCooldown(): void {
  globalCooldownUntil = Date.now() + RATE_LIMIT_CONFIG.GLOBAL_COOLDOWN_MS;
  logger.warn(`Rate limits hit on all models. Activating ${RATE_LIMIT_CONFIG.GLOBAL_COOLDOWN_MS / 1000}s cooldown.`);
}

/**
 * Resets rate limit tracking after a successful request.
 * TODO: This function is a no-op stub. If it was intended to reset state after successful requests,
 * it should be implemented or removed to avoid confusion. Consider:
 * 1. Resetting `globalCooldownUntil` here, OR
 * 2. Removing the call at L212 if no reset is truly needed.
 */
function resetRateLimitTracking(): void {
}

/**
 * Calculates exponential backoff delay for retries.
 * @param attemptNumber The current retry attempt (0-indexed)
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(attemptNumber: number): number {
  const delay = RATE_LIMIT_CONFIG.BASE_RETRY_DELAY_MS * Math.pow(RATE_LIMIT_CONFIG.COOLDOWN_MULTIPLIER, attemptNumber);
  return Math.min(delay, RATE_LIMIT_CONFIG.MAX_RETRY_DELAY_MS);
}

/**
 * Utility to wait for a specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
export function chooseModelForComplexity(preferredModel: string, userInputForComplexityCheck: string | null = null): string {
  const now = Date.now();
  const elapsed = now - lastRequestTimestamp;

  // 1. Spam Protection (Timer)
  if (elapsed < 15000) { // 15 seconds
    logger.debug("Adaptive Model: Downgrading due to frequency (<15s).", { elapsed });
    return FAST_MODEL;
  }

  // 2. Complexity Check (if input provided)
  if (userInputForComplexityCheck) {
    const safeInput = sanitizeAIInput(userInputForComplexityCheck);
    const wordCount = safeInput.trim().split(/\s+/).length;
    if (wordCount < 6) {
      return FAST_MODEL;
    }
  }

  return preferredModel;
}

export const defaultSystemInstruction =
  "You are a storyteller for a text-based high fantasy RPG set in a world of dragons, ancient magic, and looming conflict (like Krynn). Your responses MUST be EXTREMELY BRIEF, MAXIMUM 1-2 sentences. Provide ONLY essential 'breadcrumb' details. Focus on atmosphere and key information. NO long descriptions. Be concise.";

/**
 * Generic function to generate text content using the Gemini API.
 * Returns a StandardizedResult containing data on success or an error string on failure.
 *
 * Includes robust rate limiting:
 * - Global cooldown check before making requests
 * - Exponential backoff delays between model fallback attempts
 * - 30s global cooldown after exhausting all models
 */
export async function generateText(
  promptContent: string,
  systemInstruction: string | undefined,
  expectJson: boolean = false,
  functionName: string = 'generateText',
  devModelOverride: string | null = null,
  preferredModel?: string,
  thinkingBudget?: number
): Promise<StandardizedResult<GeminiTextData>> {
  const fullPromptForLogging = `System Instruction: ${systemInstruction || defaultSystemInstruction}\nUser Prompt: ${promptContent}`;

  const remainingCooldown = getRemainingCooldown();
  if (remainingCooldown > 0) {
    logger.info(`Global rate limit cooldown active. ${Math.ceil(remainingCooldown / 1000)}s remaining.`, { functionName });
    return {
      data: null,
      error: `API rate limited. Please wait ${Math.ceil(remainingCooldown / 1000)} seconds before trying again.`,
      metadata: {
        promptSent: fullPromptForLogging,
        rawResponse: "Global Cooldown Active",
        rateLimitHit: true
      }
    };
  }

  if (!isAiEnabled()) {
    logger.warn(`Gemini API disabled: generateText skipped (${functionName}).`);
    return {
      data: null,
      error: `Gemini API disabled (Missing API Key) in ${functionName}.`,
      metadata: {
        promptSent: fullPromptForLogging,
        rawResponse: "API Disabled",
        rateLimitHit: false
      }
    };
  }

  let lastError: unknown = null;
  let rateLimitHitInChain = false;
  let lastModelUsed = '';
  let attemptNumber = 0;

  const initialModel = devModelOverride || preferredModel || GEMINI_TEXT_MODEL_FALLBACK_CHAIN[0];
  const modelsToTry = [initialModel, ...GEMINI_TEXT_MODEL_FALLBACK_CHAIN.filter(m => m !== initialModel)];

  for (const model of modelsToTry) {
    lastModelUsed = model;

    if (attemptNumber > 0 && rateLimitHitInChain) {
      const backoffDelay = calculateBackoffDelay(attemptNumber - 1);
      logger.debug(`Waiting ${backoffDelay}ms before trying next model...`, { model, attemptNumber });
      await sleep(backoffDelay);
    }

    try {
      const useThinking = thinkingBudget && (model.includes('gemini-2.5') || model.includes('gemini-3'));

      const config: ExtendedGenerationConfig = {
        systemInstruction: systemInstruction || defaultSystemInstruction,
        temperature: useThinking ? undefined : 0.7,
        topK: 40,
        topP: 0.95,
        responseMimeType: expectJson ? "application/json" : undefined,
      };

      if (useThinking && thinkingBudget) {
        config.thinkingConfig = { thinkingBudget };
      }

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Request timed out after ${API_TIMEOUT_MS}ms`)), API_TIMEOUT_MS);
      });

      const response: GenerateContentResponse = await withRetry(async () => {
        return await Promise.race([
          ai.models.generateContent({
            model: model,
            contents: promptContent,
            config: config as unknown as GenerationConfig,
          }),
          timeoutPromise
        ]);
      }, {
        retries: 3,
        delay: 1000,
        backoff: 2,
        shouldRetry: (error: unknown) => {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const status = (error as { status?: number })?.status;

          if (status === 429 || errorMsg.includes('429')) return false; // Don't retry rate limits immediately
          if (status !== undefined && status >= 400 && status < 500) return false; // Don't retry client errors

          if (errorMsg.includes('503') || errorMsg.includes('network') || errorMsg.includes('fetch')) return true;
          return true; // Default to retry for safety
        }
      });

      lastRequestTimestamp = Date.now();
      resetRateLimitTracking();

      const responseText = response.text?.trim();

      if (!responseText && !expectJson) {
        return {
          data: {
            text: "You notice nothing particularly remarkable.",
            promptSent: fullPromptForLogging,
            rawResponse: JSON.stringify(response),
            rateLimitHit: rateLimitHitInChain,
          },
          error: null
        };
      }

      return {
        data: {
          text: responseText || "",
          promptSent: fullPromptForLogging,
          rawResponse: JSON.stringify(response),
          rateLimitHit: rateLimitHitInChain,
        },
        error: null
      };

    } catch (error: unknown) {
      lastError = error;
      attemptNumber++;

      let errorString = "";
      if (typeof error === 'object' && error !== null) {
        try {
          errorString = JSON.stringify(error, Object.getOwnPropertyNames(error));
        } catch {
          errorString = String(error);
        }
      } else {
        errorString = String(error);
      }

      const isRateLimitError = errorString.includes('"code":429') || errorString.includes('RESOURCE_EXHAUSTED');
      const isServiceOverloaded = errorString.includes('"code":503') || errorString.includes('overloaded');

      if (isRateLimitError || isServiceOverloaded) {
        rateLimitHitInChain = true;
        const errorType = isRateLimitError ? 'rate limit' : 'service overloaded';
        logger.warn(`Gemini API ${errorType} error with model ${model}. Attempt ${attemptNumber}/${modelsToTry.length}`, { model });
        continue;
      } else {
        const safeError = redactSensitiveData(error);
        logger.warn(`Gemini API error with model ${model}:`, { error: safeError, model });
        continue;
      }
    } finally {
      lastRequestTimestamp = Date.now();
    }
  }

  if (rateLimitHitInChain) {
    activateGlobalCooldown();
  }

  const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);

  let safeRawResponse = "Unknown error";
  if (typeof lastError === 'object' && lastError !== null) {
    try {
      safeRawResponse = JSON.stringify(lastError, Object.getOwnPropertyNames(lastError));
    } catch {
      safeRawResponse = String(lastError);
    }
  } else {
    safeRawResponse = String(lastError);
  }

  return {
    data: null,
    error: `Gemini API error in ${functionName} (Last model: ${lastModelUsed}): ${errorMessage}`,
    metadata: {
      promptSent: fullPromptForLogging,
      rawResponse: safeRawResponse,
      rateLimitHit: rateLimitHitInChain
    }
  };
}
