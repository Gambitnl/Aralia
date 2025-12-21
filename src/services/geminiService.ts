
/**
 * @file geminiService.ts
 * This service module handles all interactions with the Google Gemini API.
 * It provides functions to generate various types of text content for the RPG.
 * All functions now return a StandardizedResult object for consistent error handling.
 * 
 * Rate Limiting: Implements exponential backoff, model fallback chains, and global
 * cooldown periods to prevent overwhelming the API during heavy usage.
 */
import { GenerateContentResponse, GenerationConfig, Tool } from "@google/genai";
import { v4 as uuidv4 } from 'uuid';
import { ai, isAiEnabled } from './aiClient'; // Import the shared AI client
import { withRetry } from '../utils/networkUtils';
import { logger } from '../utils/logger';
import { Action, PlayerCharacter, InspectSubmapTilePayload, SeededFeatureConfig, Monster, GroundingChunk, TempPartyMember, GoalStatus, GoalUpdatePayload, Item, EconomyState, VillageActionContext, ItemType } from "../types";
import { SeededRandom } from '../utils/seededRandom';
import { SUBMAP_ICON_MEANINGS } from '../data/glossaryData';
import { XP_BY_CR } from '../data/dndData';
import { CLASSES_DATA } from '../data/classes';
import { MONSTERS_DATA } from '../constants';
import { GEMINI_TEXT_MODEL_FALLBACK_CHAIN, FAST_MODEL, COMPLEX_MODEL } from '../config/geminiConfig';
import * as ItemTemplates from '../data/item_templates';
import { sanitizeAIInput, redactSensitiveData, safeJSONParse, cleanAIJSON } from '../utils/securityUtils';
import { getFallbackEncounter } from './geminiServiceFallback';
import { MonsterSchema, CustomActionSchema, SocialOutcomeSchema, InventoryResponseSchema, ItemSchema } from './geminiSchemas';

const API_TIMEOUT_MS = 20000; // 20 seconds

// --- Adaptive Rate Limiting State ---
let lastRequestTimestamp = 0;
let globalCooldownUntil = 0; // Timestamp when cooldown ends (0 = no cooldown)
let consecutiveRateLimitHits = 0; // Tracks consecutive rate limit failures across all models

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
 */
function resetRateLimitTracking(): void {
  consecutiveRateLimitHits = 0;
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
function chooseModelForComplexity(preferredModel: string, userInputForComplexityCheck: string | null = null): string {
  const now = Date.now();
  const elapsed = now - lastRequestTimestamp;

  // 1. Spam Protection (Timer)
  if (elapsed < 15000) { // 15 seconds
    logger.debug("Adaptive Model: Downgrading due to frequency (<15s).", { elapsed });
    return FAST_MODEL;
  }

  // 2. Complexity Check (if input provided)
  if (userInputForComplexityCheck) {
    // Simple heuristic: split by spaces
    // Note: We use the sanitized input for this check if passed correctly by the caller,
    // but the caller might pass raw input. We'll sanitize it here just for the count check to be safe.
    const safeInput = sanitizeAIInput(userInputForComplexityCheck);
    const wordCount = safeInput.trim().split(/\s+/).length;
    if (wordCount < 6) {
      // console.debug(`Adaptive Model: Downgrading due to low complexity (${wordCount} words).`);
      return FAST_MODEL;
    }
  }

  return preferredModel;
}

// TODO(FEATURES): Improve storyteller consistency via shared prompt scaffolds, memory summaries, and response validation (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).
const defaultSystemInstruction =
  "You are a storyteller for a text-based high fantasy RPG set in a world of dragons, ancient magic, and looming conflict (like Krynn). Your responses MUST be EXTREMELY BRIEF, MAXIMUM 1-2 sentences. Provide ONLY essential 'breadcrumb' details. Focus on atmosphere and key information. NO long descriptions. Be concise.";

// --- Standardized Result Types ---

export interface GeminiMetadata {
  promptSent: string;
  rawResponse: string;
  rateLimitHit?: boolean;
}

export interface StandardizedResult<T> {
  data: T | null;
  error: string | null;
  // Optional metadata attached even on error for logging purposes
  metadata?: GeminiMetadata;
}

// TODO: Scrub or redact user-provided text before storing GeminiMetadata (Reason: prompts can carry PII and are currently logged verbatim; Expectation: keep telemetry safe while still diagnosing model issues).
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
interface ExtendedGenerationConfig extends GenerationConfig {
    systemInstruction?: string | { parts: { text: string }[] } | { role: string, parts: { text: string }[] };
    tools?: Tool[];
}

// --- Helper Functions ---

/**
 * Returns a basic inventory based on the shop type to be used as a fallback
 * when the AI fails to generate a valid inventory.
 */
function getFallbackInventory(shopType: string, seedKey?: string): Item[] {
  const defaults: Item[] = [];
  const type = shopType.toLowerCase();

  // Helper to create a basic item since ItemTemplates are schema definitions, not objects
  const createItem = (name: string, description: string, cost: string, costInGp: number, type: ItemType): Item => ({
      id: uuidv4(),
      name,
      description,
      cost,
      costInGp,
      type,
      weight: 1, // Default
      icon: "📦" // Default
  });

  // Generic fallback items available everywhere
  defaults.push(createItem("Rations", "Standard travel rations.", "5 cp", 0.05, ItemType.FoodDrink));
  defaults.push(createItem("Torch", "A simple torch.", "1 cp", 0.01, ItemType.LightSource));

  // Deterministic "extra stock" so different buildings don't all sell the same 2 items
  // when AI generation is unavailable (e.g., no API key, rate-limit, or parse failures).
  const hashToSeed = (input: string): number => {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
    }
    return hash || 1;
  };
  const rng = new SeededRandom(hashToSeed(`${type}|${seedKey ?? ''}`));

  const generalPool: Array<[string, string, string, number, ItemType]> = [
    ["Waterskin", "A basic waterskin.", "2 sp", 0.2, ItemType.Consumable],
    ["Flint & Steel", "A kit for starting fires.", "5 sp", 0.5, ItemType.Tool],
    ["Bedroll", "A rough bedroll for travel.", "1 sp", 0.1, ItemType.Tool],
    ["Soap", "A bar of soap.", "2 cp", 0.02, ItemType.Consumable],
    ["Chalk", "A stick of chalk.", "1 cp", 0.01, ItemType.Tool],
  ];

  const housePool: Array<[string, string, string, number, ItemType]> = [
    ["Needle & Thread", "Simple repair kit for clothes.", "5 cp", 0.05, ItemType.Tool],
    ["Lantern Oil (Small)", "A small flask of lamp oil.", "1 sp", 0.1, ItemType.Consumable],
    ["Dried Herbs", "Common cooking herbs.", "3 cp", 0.03, ItemType.FoodDrink],
    ["Handmade Charm", "A lucky charm of local make.", "8 cp", 0.08, ItemType.Treasure],
  ];

  if (type.includes('blacksmith') || type.includes('weapon') || type.includes('armor')) {
    defaults.push(createItem("Iron Dagger", "A simple iron dagger.", "2 gp", 2, ItemType.Weapon));
    defaults.push(createItem("Whetstone", "For sharpening blades.", "1 cp", 0.01, ItemType.Tool));
  } else if (type.includes('alchemist') || type.includes('potion') || type.includes('magic')) {
    defaults.push(createItem("Empty Vial", "A glass vial.", "1 gp", 1, ItemType.Consumable));
    defaults.push(createItem("Herbal Poultice", "Basic healing herbs.", "5 sp", 0.5, ItemType.Potion));
  } else if (type.includes('general') || type.includes('goods')) {
    defaults.push(createItem("Rope (50ft)", "Hempen rope.", "1 gp", 1, ItemType.Tool));
    defaults.push(createItem("Waterskin", "For carrying water.", "2 sp", 0.2, ItemType.Consumable));
  } else if (type.includes('house')) {
    // Houses aren't always shops, but TownCanvas currently routes "enter" to a merchant modal.
    // Give them a small, varied set of household goods instead of always the same 2 items.
    defaults.push(createItem("Bread Loaf", "Fresh-baked bread.", "2 cp", 0.02, ItemType.FoodDrink));
  }

  const pickUnique = <T,>(pool: T[], count: number): T[] => {
    const copy = [...pool];
    const picked: T[] = [];
    while (copy.length > 0 && picked.length < count) {
      const idx = rng.nextInt(0, copy.length);
      picked.push(copy.splice(idx, 1)[0]);
    }
    return picked;
  };

  const extraCount = 2 + rng.nextInt(0, 3); // 2-4 extras
  const pool = type.includes('house') ? [...housePool, ...generalPool] : generalPool;
  pickUnique(pool, extraCount).forEach(([name, desc, cost, gp, itemType]) => {
    defaults.push(createItem(name, desc, cost, gp, itemType));
  });

  return defaults;
}


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
  systemInstruction?: string,
  expectJson: boolean = false,
  functionName: string = 'generateText',
  devModelOverride: string | null = null,
  preferredModel?: string,
  thinkingBudget?: number
): Promise<StandardizedResult<GeminiTextData>> {
  const fullPromptForLogging = `System Instruction: ${systemInstruction || defaultSystemInstruction}\nUser Prompt: ${promptContent}`;

  // Check for global cooldown before proceeding
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

    // Apply exponential backoff delay before retry (skip first attempt)
    if (attemptNumber > 0 && rateLimitHitInChain) {
      const backoffDelay = calculateBackoffDelay(attemptNumber - 1);
      logger.debug(`Waiting ${backoffDelay}ms before trying next model...`, { model, attemptNumber });
      await sleep(backoffDelay);
    }

    try {
      const useThinking = thinkingBudget && (model.includes('gemini-2.5') || model.includes('gemini-3'));

      // Use ExtendedGenerationConfig to allow systemInstruction
      const config: ExtendedGenerationConfig = {
        systemInstruction: systemInstruction || defaultSystemInstruction,
        temperature: useThinking ? undefined : 0.7,
        topK: 40,
        topP: 0.95,
        responseMimeType: expectJson ? "application/json" : undefined,
      };

      if (useThinking) {
        config.thinkingConfig = { thinkingBudget };
      }

      // Wrap generateContent with a timeout to prevent hung requests when a prompt exceeds latency budgets.
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Request timed out after ${API_TIMEOUT_MS}ms`)), API_TIMEOUT_MS);
      });

      // Execute request with retry logic
      const response: GenerateContentResponse = await withRetry(async () => {
        // Cast config to any or GenerationConfig (with ignore) because the official type lacks systemInstruction
        return await Promise.race([
          ai.models.generateContent({
            model: model,
            contents: promptContent,
            config: config as any,
          }),
          timeoutPromise
        ]);
      }, {
        retries: 3,
        delay: 1000,
        backoff: 2,
        shouldRetry: (error: any) => {
          // Retry on network errors or 503 Service Unavailable
          // Specifically check for rate limit errors or server errors which might be transient
          const errorMsg = error?.message || '';
          const status = error?.status;

          if (status === 429 || errorMsg.includes('429')) return false; // Don't retry rate limits immediately
          if (status >= 400 && status < 500) return false; // Don't retry client errors

          if (errorMsg.includes('503') || errorMsg.includes('network') || errorMsg.includes('fetch')) return true;
          return true; // Default to retry for safety
        }
      });

      // Success! Update timestamp and reset rate limit tracking
      lastRequestTimestamp = Date.now();
      resetRateLimitTracking();

      const responseText = response.text?.trim();

      if (!responseText && !expectJson) {
        // Treat empty text as a soft error but return valid data structure to avoid crashes
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
          } catch(e) {
             errorString = String(error);
          }
      } else {
          errorString = String(error);
      }

      // Check for rate limit (429) or service overloaded (503) errors
      const isRateLimitError = errorString.includes('"code":429') || errorString.includes('RESOURCE_EXHAUSTED');
      const isServiceOverloaded = errorString.includes('"code":503') || errorString.includes('overloaded');

      if (isRateLimitError || isServiceOverloaded) {
        rateLimitHitInChain = true;
        consecutiveRateLimitHits++;
        const errorType = isRateLimitError ? 'rate limit' : 'service overloaded';
        logger.warn(`Gemini API ${errorType} error with model ${model}. Attempt ${attemptNumber}/${modelsToTry.length}`, { model });
        continue;
      } else {
        // Redact potential API keys from the error object before logging
        const safeError = redactSensitiveData(error);
        logger.warn(`Gemini API error with model ${model}:`, { error: safeError, model });
        continue;
      }
    } finally {
      lastRequestTimestamp = Date.now();
    }
  }

  // All models exhausted - activate global cooldown if rate limits were hit
  if (rateLimitHitInChain) {
    activateGlobalCooldown();
  }

  const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);

  let safeRawResponse = "Unknown error";
  if (typeof lastError === 'object' && lastError !== null) {
      try {
          safeRawResponse = JSON.stringify(lastError, Object.getOwnPropertyNames(lastError));
      } catch (e) {
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


export async function generateLocationDescription(
  locationName: string,
  context: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiTextData>> {
  const systemInstruction = "Describe a new location in a high fantasy RPG. Response MUST be EXTREMELY BRIEF: 1-2 sentences MAX. Give ONLY key sights, sounds, or atmosphere. No fluff.";

  // Structured prompt for better narrative consistency
  const prompt = `## NARRATIVE TASK
Describe the location "${locationName}" as the player arrives. Focus on atmosphere, key features, and sensory details (sound/smell).

${context}

## OUTPUT
Provide an EXTREMELY BRIEF description (1-2 sentences MAX). No fluff.`;

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
  const systemInstruction = "You are a concise storyteller describing a wilderness location in a fantasy RPG. Response MUST be 2-3 sentences. Focus on immediate sensory details. No long descriptions.";

  // Structured prompt for better narrative consistency
  const prompt = `## NARRATIVE TASK
Describe the wilderness area the player has moved into.
Biome: ${biomeName}
Coordinates: World(${worldMapCoords.x},${worldMapCoords.y}) Sub(${subMapCoords.x},${subMapCoords.y})
Broader Region: ${worldMapTileTooltip || 'None'}

${playerContext}

## OUTPUT
Provide a brief, 2-3 sentence description focusing on immediate sensory details (weather, terrain, wildlife sounds).`;

  return await generateText(prompt, systemInstruction, false, 'generateWildernessLocationDescription', devModelOverride, FAST_MODEL);
}

export async function generateNPCResponse(
  personalityPrompt: string,
  fullPrompt: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiTextData>> {
  const adaptiveModel = chooseModelForComplexity(COMPLEX_MODEL, null);
  return await generateText(fullPrompt, personalityPrompt, false, 'generateNPCResponse', devModelOverride, adaptiveModel);
}

function validateNarrativeResponse(text: string): string {
  if (!text) return text;

  // Truncate if excessively long (over 500 chars is likely a hallucination or failure to be concise)
  if (text.length > 500) {
    return text.substring(0, 497) + "...";
  }

  // Basic check for AI-isms
  if (text.startsWith("As an AI") || text.includes("I cannot generate")) {
    return "The action has no discernible effect.";
  }

  return text;
}

export async function generateActionOutcome(
  playerAction: string,
  context: string,
  isCustomGeminiAction: boolean = false,
  worldMapTileTooltip?: string | null,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiTextData>> {
  // Validate Context Richness
  if (!context || context.length < 50) {
    logger.warn("generateActionOutcome: Context provided is extremely sparse. AI hallucination risk increased.", { action: playerAction, contextLength: context?.length });
  }

  let systemInstruction = isCustomGeminiAction
    ? "You are the Dungeon Master for Aralia, a high-fantasy RPG. Narrate the outcome of the player's creative action. Focus on 'showing' not 'telling'. Maintain strict continuity with the Context. If the action is impossible, narrate the failure naturally. Keep responses concise (2-3 sentences) but evocative."
    : "You are the Dungeon Master for Aralia, a high-fantasy RPG. Narrate the outcome of the player's action. Focus on 'showing' not 'telling'. Maintain strict continuity with the Context. Keep responses concise (2-3 sentences) but evocative.";

  const sanitizedAction = sanitizeAIInput(playerAction);

  // If the action implies listening or gathering information, guide the AI to use rumors
  const actionLower = sanitizedAction.toLowerCase();
  const isInformationGathering = actionLower.includes('listen') || actionLower.includes('rumor') || actionLower.includes('news') || actionLower.includes('gossip') || actionLower.includes('hear');

  if (isInformationGathering) {
      systemInstruction += " If the player is listening for rumors or news, prioritize information from the 'WORLD RUMORS & NEWS' section of the context.";
  }

  const adaptiveModel = chooseModelForComplexity(COMPLEX_MODEL, sanitizedAction); // Default to PRO for quality narration, downgrades if spammy/short

  // Structured prompt construction for better context adherence (Chronicler Learning)
  // Note: 'context' now contains its own headers (## PLAYER, ## LOCATION, etc.)
  let prompt = `## PLAYER ACTION\n${sanitizedAction}\n\n${context}`;

  if (sanitizedAction.toLowerCase().includes("look around") && worldMapTileTooltip) {
    prompt += `\n\n## BROADER CONTEXT (Look Around)\n${worldMapTileTooltip}`;
  }

  prompt += `\n\n## NARRATIVE GUIDELINES\n- Tone: High Fantasy, Immersive, Gritty.\n- Focus on immediate sensory details (sight, sound, smell).\n- Do not moralize or lecture; if an action fails, describe the attempt failing.\n- Stay in character as the Dungeon Master.\n- Keep response under 3 sentences.`;

  const result = await generateText(prompt, systemInstruction, false, 'generateActionOutcome', devModelOverride, adaptiveModel);

  if (result.data) {
    result.data.text = validateNarrativeResponse(result.data.text);
  }

  // TODO(Linker): Use EntityResolverService.ensureEntityExists() to generate missing entities from AI text and dispatch 'REGISTER_ENTITIES' action.
  // const entities = await EntityResolverService.resolveEntitiesInText(result.data.text, { gameState });
  // This requires plumbing GameState into this service or accessing a global store.

  return result;
}

export async function generateDynamicEvent(
  currentLocationName: string,
  context: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiTextData>> {
  const systemInstruction = 'You are a Dungeon Master creating a minor, unexpected event in a fantasy RPG. Response MUST be 1-2 sentences MAX.';
  const prompt = `Location: ${currentLocationName}. Context: ${context}. Create a brief, minor, unexpected event.`;
  return await generateText(prompt, systemInstruction, false, 'generateDynamicEvent', devModelOverride, FAST_MODEL);
}

export async function generateOracleResponse(
  playerQuery: string,
  context: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiTextData>> {
  const systemInstruction = "You are the Oracle, a mysterious, wise entity. Respond to the player's query. Your response MUST be enigmatic and brief (1-2 sentences MAX). Speak in the first person. Do NOT give a direct answer; provide a cryptic clue.";

  const sanitizedQuery = sanitizeAIInput(playerQuery);

  const adaptiveModel = chooseModelForComplexity(COMPLEX_MODEL, sanitizedQuery);

  const prompt = `A player asks me, the Oracle: "${sanitizedQuery}"\nMy context: ${context}\nMy brief, cryptic, first-person response is:`;
  return await generateText(prompt, systemInstruction, false, 'generateOracleResponse', devModelOverride, adaptiveModel);
}

export async function generateCharacterName(
  race: string,
  className: string,
  gender: string,
  setting: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<{ name: string | null } & GeminiMetadata>> {
  const prompt = `Generate a single, fitting, full character name (first and last) for a ${gender} ${race} ${className} in a ${setting}-style fantasy world. Return ONLY the name, nothing else.`;
  const result = await generateText(prompt, "You are a fantasy name generator.", false, 'generateCharacterName', devModelOverride, FAST_MODEL);

  if (result.error || !result.data) {
    return { data: null, error: result.error, metadata: result.metadata };
  }

  return {
    data: {
      name: result.data.text,
      promptSent: result.data.promptSent,
      rawResponse: result.data.rawResponse,
      rateLimitHit: result.data.rateLimitHit
    },
    error: null
  };
}

export async function generateTileInspectionDetails(
  tileDetails: InspectSubmapTilePayload,
  playerCharacter: PlayerCharacter,
  gameTime: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiTextData>> {
  const systemInstruction = `You are a Dungeon Master describing what a player character observes when they carefully inspect a nearby area in a fantasy RPG. Your response must be an evocative, 2-3 sentence description. CRITICAL: Do NOT use game jargon. Focus on sensory details.`;

  let featureContext = "no specific large feature.";
  if (tileDetails.activeFeatureConfig) {
    const feature = tileDetails.activeFeatureConfig;
    featureContext = `a notable feature: a ${feature.name || feature.id}. This feature is represented visually by the icon '${feature.icon}'.`;
    const iconMeaning = SUBMAP_ICON_MEANINGS[feature.icon];
    if (iconMeaning) {
      featureContext += ` (The icon '${feature.icon}' generally signifies: ${iconMeaning}).`;
    }
  }

  let terrainContext = tileDetails.effectiveTerrainType;
  if (terrainContext === 'path_adj') terrainContext = 'area immediately adjacent to a discernible path';
  if (terrainContext === 'path') terrainContext = 'a discernible path';

  const prompt = `Player Character (${playerCharacter.name}) is inspecting a specific spot.
  - Current Time: ${gameTime}
  - General Biome: ${tileDetails.worldBiomeId}
  - Terrain Type: ${terrainContext}
  - The spot contains: ${featureContext}
  Describe what the character sees, hears, or smells in 2-3 sentences.`;

  return await generateText(prompt, systemInstruction, false, 'generateTileInspectionDetails', devModelOverride);
}

export async function generateEncounter(
  xpBudget: number,
  themeTags: string[],
  party: TempPartyMember[],
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiEncounterData>> {
  const partyComposition = party.map(p => `Level ${p.level} ${CLASSES_DATA[p.classId]?.name || 'Adventurer'}`).join(', ');
  const systemInstruction = `You are an expert D&D Dungeon Master creating a balanced combat encounter using Google Search for monster ideas.
  - The party's total XP budget for a medium encounter is ${xpBudget} XP.
  - You MUST suggest between 1 and 4 total monsters.
  - Find monsters that fit the themes: ${themeTags.join(', ')}.
  - The response MUST be a valid JSON array of objects. Keys: "name", "quantity", "cr", "description".
  - Provide ONLY the JSON array.`;

  const prompt = `Create a medium-difficulty D&D 5e encounter for a party of ${party.length} adventurers (${partyComposition}) with an XP budget of ${xpBudget}. Themes: ${themeTags.join(', ')}.`;
  const fullPromptForLogging = `System Instruction: ${systemInstruction}\nUser Prompt: ${prompt}`;

  if (!isAiEnabled()) {
    return {
      data: null,
      error: "Gemini API disabled (Missing API Key) in generateEncounter.",
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

  const adaptiveModel = chooseModelForComplexity(COMPLEX_MODEL, null);
  const initialModel = devModelOverride || adaptiveModel;
  const modelsToTry = [initialModel, ...GEMINI_TEXT_MODEL_FALLBACK_CHAIN.filter(m => m !== initialModel)];

  for (const model of modelsToTry) {
    lastModelUsed = model;
    try {
      const useThinking = model.includes('gemini-2.5') || model.includes('gemini-3');
      const config: ExtendedGenerationConfig = {
        systemInstruction: systemInstruction,
        tools: [{ googleSearch: {} }],
      };

      if (useThinking) {
        config.thinkingConfig = { thinkingBudget: 32768 };
      }

      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: config as any,
      });

      const responseText = response.text?.trim();
      let encounter: Monster[] = [];

      if (responseText) {
        try {
          const jsonString = cleanAIJSON(responseText);
          const parsed = safeJSONParse(jsonString);
          if (!parsed) throw new Error("Parsed JSON is null");
          encounter = MonsterSchema.array().parse(parsed);
        } catch (e) {
          logger.error(`Failed to parse JSON from generateEncounter with model ${model}:`, { responseText, error: e });
          throw new Error("The AI returned a malformed encounter suggestion.");
        }
      }

      const groundingChunksFromApi = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources: GroundingChunk[] = groundingChunksFromApi
        .map(chunk => chunk.web && chunk.web.uri ? { web: { uri: chunk.web.uri, title: chunk.web.title || chunk.web.uri } } : null)
        .filter((chunk): chunk is GroundingChunk => chunk !== null);

      return {
        data: {
          encounter,
          sources,
          promptSent: fullPromptForLogging,
          rawResponse: JSON.stringify(response),
          rateLimitHit: rateLimitHitInChain,
        },
        error: null
      };
    } catch (error: unknown) {
      lastError = error;

      let errorString = "";
      if (typeof error === 'object' && error !== null) {
          try {
             errorString = JSON.stringify(error, Object.getOwnPropertyNames(error));
          } catch(e) {
             errorString = String(error);
          }
      } else {
          errorString = String(error);
      }

      if (errorString.includes('"code":429') || errorString.includes('RESOURCE_EXHAUSTED')) {
        rateLimitHitInChain = true;
        logger.warn(`Gemini API rate limit error with model ${model}. Retrying...`);
      } else {
        const safeError = redactSensitiveData(error);
        logger.warn(`Gemini API error with model ${model}:`, { error: safeError });
      }
      continue;
    } finally {
      lastRequestTimestamp = Date.now();
    }
  }

  const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);

  // Use fallback if AI fails
  logger.warn(`AI Encounter Generation failed. Using fallback. Error: ${errorMessage}`);
  const fallbackEncounter = getFallbackEncounter(xpBudget, themeTags);

  return {
    data: {
      encounter: fallbackEncounter,
      sources: [], // No sources for fallback
      promptSent: fullPromptForLogging,
      rawResponse: `Fallback used due to error: ${errorMessage}`,
      rateLimitHit: rateLimitHitInChain
    },
    error: null, // Clear error since we handled it gracefully
    metadata: {
      promptSent: fullPromptForLogging,
      rawResponse: `Fallback used due to error: ${errorMessage}`,
      rateLimitHit: rateLimitHitInChain
    }
  };
}


export async function generateCustomActions(
  sceneDescription: string,
  context: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiCustomActionData>> {
  const systemInstruction = `You are a creative Dungeon Master suggesting actions.
    Based on the scene, suggest up to 3 brief, non-navigational, context-aware actions.
    Format as a valid JSON array of objects with keys: 'label', 'geminiPrompt'.
    Optional keys: 'type' (e.g., 'ENTER_VILLAGE'), 'check' (skill name), 'targetNpcId', 'eventResidue' ({text, discoveryDc}), 'isEgregious' (boolean).
    Provide ONLY the JSON array.`;
  const prompt = `Scene: "${sceneDescription}"\nContext: ${context}`;

  const result = await generateText(prompt, systemInstruction, true, 'generateCustomActions', devModelOverride, FAST_MODEL);

  // Fallback actions
  const fallbackActions: Action[] = [{
    type: 'gemini_custom_action',
    label: 'Look around cautiously',
    payload: {
      geminiPrompt: 'Describe the immediate surroundings in detail.',
      check: 'Perception',
      isEgregious: false
    }
  }];

  if (result.error || !result.data) {
    return {
      data: {
        text: "Error calling AI service.",
        promptSent: result.metadata?.promptSent || "",
        rawResponse: result.metadata?.rawResponse || "",
        rateLimitHit: result.metadata?.rateLimitHit,
        actions: fallbackActions
      },
      error: result.error,
      metadata: result.metadata
    };
  }

  let actions: Action[] = [];
  try {
    const jsonString = cleanAIJSON(result.data.text);
    const parsedActions = safeJSONParse(jsonString);
    if (!parsedActions) throw new Error("Parsed JSON is null");
    const validatedActions = CustomActionSchema.array().parse(parsedActions);

    actions = validatedActions.map(a => ({
      type: a.type === 'ENTER_VILLAGE' ? 'ENTER_VILLAGE' : 'gemini_custom_action',
      label: a.label,
      payload: {
        geminiPrompt: a.geminiPrompt,
        check: a.check,
        targetNpcId: a.targetNpcId,
        eventResidue: a.eventResidue,
        isEgregious: a.isEgregious,
      },
    }));
  } catch (e) {
    logger.error("Failed to parse JSON from generateCustomActions:", { rawText: result.data.text, error: e });
    return {
      data: {
        ...result.data,
        actions: fallbackActions
      },
      error: "Failed to parse custom actions JSON. Using fallback.",
      metadata: { ...result.data, rawResponse: result.data.text }
    };
  }

  return {
    data: {
      ...result.data,
      actions
    },
    error: null
  };
}

export async function generateSocialCheckOutcome(
  skillName: string,
  npcName: string,
  wasSuccess: boolean,
  context: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiSocialCheckData>> {
  const systemInstruction = `You are a Dungeon Master narrating the outcome of a social skill check.
    Response MUST be a valid JSON object with keys: "outcomeText", "dispositionChange" (number), "memoryFactText", and optional "goalUpdate" ({npcId, goalId, newStatus}).
    Provide ONLY the JSON object.`;
  const prompt = `A player attempted a ${skillName} check against ${npcName} and ${wasSuccess ? 'SUCCEEDED' : 'FAILED'}.
    Context: ${context}`;

  const result = await generateText(prompt, systemInstruction, true, 'generateSocialCheckOutcome', devModelOverride);

  // Define fallback data generator for consistency
  const getFallbackData = () => ({
    outcomeText: wasSuccess ? `${npcName} seems to consider your words.` : `${npcName} seems unconvinced.`,
    dispositionChange: wasSuccess ? 2 : -2,
    memoryFactText: `The player's ${skillName} check was ${wasSuccess ? 'successful' : 'unsuccessful'}.`,
    goalUpdate: null
  });

  if (result.error || !result.data) {
    // Fallback data for graceful degradation
    return {
      data: {
        text: "Error parsing AI response.",
        promptSent: result.metadata?.promptSent || "",
        rawResponse: result.metadata?.rawResponse || "",
        rateLimitHit: result.metadata?.rateLimitHit,
        ...getFallbackData()
      },
      error: result.error
    };
  }

  try {
    const jsonString = cleanAIJSON(result.data.text);
    const parsed = safeJSONParse(jsonString);
    if (!parsed) throw new Error("Parsed JSON is null");
    const validated = SocialOutcomeSchema.parse(parsed);

    // Cast the status to match GoalStatus enum if needed or ensure safe usage
    const safeGoalUpdate: GoalUpdatePayload | null = validated.goalUpdate ? {
      npcId: validated.goalUpdate.npcId,
      goalId: validated.goalUpdate.goalId,
      newStatus: validated.goalUpdate.newStatus as GoalStatus
    } : null;

    return {
      data: {
        ...result.data,
        outcomeText: validated.outcomeText || "The situation evolves...",
        dispositionChange: validated.dispositionChange || (wasSuccess ? 1 : -1),
        memoryFactText: validated.memoryFactText || `Player check: ${skillName} (${wasSuccess ? 'Success' : 'Fail'})`,
        goalUpdate: safeGoalUpdate,
      },
      error: null
    };
  } catch (e) {
    return {
      data: {
        ...result.data,
        ...getFallbackData()
      },
      error: "Failed to parse social outcome JSON. Using fallback.",
      metadata: result.data
    };
  }
}

export async function rephraseFactForGossip(
  factText: string,
  speakerPersonality: string,
  listenerPersonality: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiTextData>> {
  const systemInstruction = `You are an editor for an RPG. Rephrase a fact as a rumor from one character to another. Response MUST be ONLY the rephrased sentence.`;
  const prompt = `Speaker: "${speakerPersonality}". Listener: "${listenerPersonality}". Original fact: "${factText}". Rephrase for the listener.`;

  return await generateText(prompt, systemInstruction, false, 'rephraseFactForGossip', devModelOverride, FAST_MODEL);
}

export async function generateSituationAnalysis(
  context: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiTextData>> {
  const systemInstruction = `You are a helpful Dungeon Master assistant. Analyze the game context and offer a brief, strategic hint (2-3 sentences).`;
  const prompt = `Analyze this game state and provide a hint: ${context}`;

  return await generateText(prompt, systemInstruction, false, 'generateSituationAnalysis', devModelOverride, FAST_MODEL);
}


export async function generateMerchantInventory(
  villageContext: VillageActionContext | undefined,
  shopType: string,
  devModelOverride: string | null = null,
  seedKey?: string
): Promise<StandardizedResult<GeminiInventoryData>> {
  const templateString = Object.entries(ItemTemplates).map(([key, tmpl]) => `${key}: ${JSON.stringify(tmpl)}`).join('\n\n');
  // Spell out the village context so Gemini receives the culture/biome cues
  // alongside the building description. This keeps inventories consistent with
  // the generated settlement instead of relying on a generic fallback.
  const contextDescription = villageContext
    ? `A ${shopType} near ${villageContext.buildingType} at (${villageContext.worldX}, ${villageContext.worldY}) in biome ${villageContext.biomeId}. Personality prompt: ${villageContext.integrationPrompt}. Cultural signature: ${villageContext.culturalSignature}. Hooks: ${(villageContext.encounterHooks || []).join(' | ')}. Location detail: ${villageContext.description}`
    : `A ${shopType} with no specific village context; default to a frontier trading post vibe.`;
  const systemInstruction = `You are a Game Master generating a shop inventory.
    Context: ${contextDescription}.
    Return a JSON object with keys: "inventory" (array of items using provided schemas) and "economy" (scarcity/surplus data).
    ITEM SCHEMAS: ${templateString}`;

  const prompt = `Generate inventory for ${shopType}.`;

  const result = await generateText(prompt, systemInstruction, true, 'generateMerchantInventory', devModelOverride);

  // Use a default EconomyState for fallbacks
  const defaultEconomy: EconomyState = {
      marketFactors: { scarcity: [], surplus: [] },
      buyMultiplier: 1.0,
      sellMultiplier: 0.5
  };

  // If the API call itself failed
  if (result.error || !result.data) {
    return {
      data: {
        // text: "Failed to generate inventory.", // REMOVED to satisfy type
        promptSent: result.metadata?.promptSent || "",
        rawResponse: result.metadata?.rawResponse || "",
        rateLimitHit: result.metadata?.rateLimitHit,
        inventory: getFallbackInventory(shopType, seedKey),
        economy: defaultEconomy
      },
      error: result.error,
      metadata: result.metadata
    };
  }

  try {
    const jsonString = cleanAIJSON(result.data.text);
    const parsed = safeJSONParse(jsonString);
    if (!parsed) throw new Error("Parsed JSON is null");
    const validated = InventoryResponseSchema.parse(parsed);

    // Ensure items have IDs
    const safeInventory = validated.inventory.map(item => ({
      ...item,
      id: item.id || uuidv4(),
      cost: String(item.cost) // Ensure cost is a string (Item interface)
    })) as Item[];

    // Ensure economy matches EconomyState interface
    const economyState: EconomyState = {
        marketFactors: {
            scarcity: validated.economy?.scarcity || [],
            surplus: validated.economy?.surplus || []
        },
        buyMultiplier: 1.0,
        sellMultiplier: 0.5,
        ...validated.economy // Override if present and matching
    };

    // Fix mismatch if validated.economy had flat structure instead of marketFactors
    if (validated.economy) {
         if ((validated.economy as any).scarcity) economyState.marketFactors.scarcity = (validated.economy as any).scarcity;
         if ((validated.economy as any).surplus) economyState.marketFactors.surplus = (validated.economy as any).surplus;
    }

    return {
      data: {
        ...result.data,
        inventory: safeInventory,
        economy: economyState
      },
      error: null
    };
  } catch (e) {
    // If the API succeeded but returned malformed JSON
    logger.warn("Failed to parse inventory JSON. Using fallback.", { error: e });
    return {
      data: {
        // ...result.data, // REMOVED because result.data has 'text', which GeminiInventoryData does not allow.
        promptSent: result.data.promptSent,
        rawResponse: result.data.rawResponse,
        rateLimitHit: result.data.rateLimitHit,
        inventory: getFallbackInventory(shopType, seedKey),
        economy: defaultEconomy
      },
      error: "Failed to parse inventory JSON. Using fallback.",
      metadata: result.data
    };
  }
}

export async function generateHarvestLoot(
  sourceName: string,
  biome: string,
  skillCheckResult: number,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiHarvestData>> {
  const relevantTemplates = { Food: ItemTemplates.FoodDrinkTemplate, Material: ItemTemplates.CraftingMaterialTemplate, Base: ItemTemplates.BaseItemTemplate };
  const systemInstruction = `You are a Game Master resolving a harvest attempt.
    Context: Harvesting "${sourceName}" in "${biome}". Check: ${skillCheckResult} (DC 10/15/20).
    Return a JSON array of Item objects.
    SCHEMAS: ${JSON.stringify(relevantTemplates)}`;

  const prompt = `Harvesting ${sourceName}. Generate items.`;
  const result = await generateText(prompt, systemInstruction, true, 'generateHarvestLoot', devModelOverride);

  if (result.error || !result.data) {
    return {
      data: {
        promptSent: result.metadata?.promptSent || "",
        rawResponse: result.metadata?.rawResponse || "",
        rateLimitHit: result.metadata?.rateLimitHit,
        items: []
      },
      error: result.error,
      metadata: result.metadata
    };
  }

  try {
    const jsonString = cleanAIJSON(result.data.text);
    const parsed = safeJSONParse(jsonString);
    if (!parsed) throw new Error("Parsed JSON is null");
    const rawItems = ItemSchema.array().parse(parsed);

    const items = rawItems.map(item => ({
      ...item,
      id: item.id || uuidv4(),
      cost: String(item.cost) // Ensure cost is a string
    })) as Item[];

    return {
      data: {
          promptSent: result.data.promptSent,
          rawResponse: result.data.rawResponse,
          rateLimitHit: result.data.rateLimitHit,
          items
      },
      error: null
    };
  } catch (e) {
    return {
      data: {
        items: [],
        promptSent: result.data.promptSent,
        rawResponse: result.data.rawResponse,
        rateLimitHit: result.data.rateLimitHit
      },
      error: "Failed to parse harvest JSON. Found nothing.",
      metadata: result.data
    };
  }
}

export async function generateGuideResponse(
  query: string,
  context: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiTextData>> {
  const systemInstruction = `You are the 'Game Guide', a helpful AI assistant for the Aralia RPG.
  Your goal is to answer player questions. You can also output a JSON object with 'tool': 'create_character' configuration if asked to create a character.`;

  const sanitizedQuery = sanitizeAIInput(query);

  const prompt = `User Query: "${sanitizedQuery}"\nCurrent Game Context: ${context}`;

  return await generateText(
    prompt,
    systemInstruction,
    false,
    'generateGuideResponse',
    devModelOverride,
    COMPLEX_MODEL,
    32768
  );
}
