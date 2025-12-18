
/**
 * @file geminiService.ts
 * This service module handles all interactions with the Google Gemini API.
 * It provides functions to generate various types of text content for the RPG.
 * All functions now return a StandardizedResult object for consistent error handling.
 */
// TODO: Add client-side rate limiting and request queuing for AI API calls to prevent overwhelming the service during heavy usage
import { GenerateContentResponse } from "@google/genai";
import { ai, isAiEnabled } from './aiClient'; // Import the shared AI client
import { logger } from '../utils/logger';
import { Action, PlayerCharacter, InspectSubmapTilePayload, SeededFeatureConfig, Monster, GroundingChunk, TempPartyMember, GoalStatus, GoalUpdatePayload, Item, EconomyState, VillageActionContext } from "../types";
import { SUBMAP_ICON_MEANINGS } from '../data/glossaryData';
import { XP_BY_CR } from '../data/dndData';
import { CLASSES_DATA } from '../data/classes';
import { MONSTERS_DATA } from '../constants';
import { GEMINI_TEXT_MODEL_FALLBACK_CHAIN, FAST_MODEL, COMPLEX_MODEL } from '../config/geminiConfig';
import * as ItemTemplates from '../data/item_templates';
import { sanitizeAIInput, redactSensitiveData } from '../utils/securityUtils';

const API_TIMEOUT_MS = 20000; // 20 seconds

// --- Adaptive Rate Limiting State ---
let lastRequestTimestamp = 0;

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

// --- Helper Functions ---

/**
 * Returns a basic inventory based on the shop type to be used as a fallback
 * when the AI fails to generate a valid inventory.
 */
function getFallbackInventory(shopType: string): Item[] {
  const defaults: Item[] = [];
  const type = shopType.toLowerCase();

  // Generic fallback items available everywhere
  defaults.push({ ...ItemTemplates.FoodDrinkTemplate, name: "Rations", description: "Standard travel rations.", cost: 5 });
  defaults.push({ ...ItemTemplates.BaseItemTemplate, name: "Torch", description: "A simple torch.", cost: 1 });

  if (type.includes('blacksmith') || type.includes('weapon') || type.includes('armor')) {
     defaults.push({ ...ItemTemplates.BaseItemTemplate, name: "Iron Dagger", description: "A simple iron dagger.", cost: 10 });
     defaults.push({ ...ItemTemplates.BaseItemTemplate, name: "Whetstone", description: "For sharpening blades.", cost: 2 });
  } else if (type.includes('alchemist') || type.includes('potion') || type.includes('magic')) {
     defaults.push({ ...ItemTemplates.BaseItemTemplate, name: "Empty Vial", description: "A glass vial.", cost: 5 });
     defaults.push({ ...ItemTemplates.BaseItemTemplate, name: "Herbal Poultice", description: "Basic healing herbs.", cost: 15 });
  } else if (type.includes('general') || type.includes('goods')) {
     defaults.push({ ...ItemTemplates.BaseItemTemplate, name: "Rope (50ft)", description: "Hempen rope.", cost: 10 });
     defaults.push({ ...ItemTemplates.BaseItemTemplate, name: "Waterskin", description: "For carrying water.", cost: 2 });
  }

  return defaults;
}


/**
 * Generic function to generate text content using the Gemini API.
 * Returns a StandardizedResult containing data on success or an error string on failure.
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

  let lastError: any = null;
  let rateLimitHitInChain = false;
  let lastModelUsed = '';

  const initialModel = devModelOverride || preferredModel || GEMINI_TEXT_MODEL_FALLBACK_CHAIN[0];
  const modelsToTry = [initialModel, ...GEMINI_TEXT_MODEL_FALLBACK_CHAIN.filter(m => m !== initialModel)];

  for (const model of modelsToTry) {
    lastModelUsed = model;
    try {
      const useThinking = thinkingBudget && (model.includes('gemini-2.5') || model.includes('gemini-3'));

      const config: any = {
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

      const response: GenerateContentResponse = await Promise.race([
        ai.models.generateContent({
          model: model,
          contents: promptContent,
          config: config,
        }),
        timeoutPromise
      ]);

      // Update timestamp on successful request
      lastRequestTimestamp = Date.now();

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

    } catch (error) {
      lastError = error;
      const errorString = JSON.stringify(error, Object.getOwnPropertyNames(error));
      if (errorString.includes('"code":429') || errorString.includes('RESOURCE_EXHAUSTED')) {
        rateLimitHitInChain = true;
        logger.warn(`Gemini API rate limit error with model ${model}. Retrying...`, { model });
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

  const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
  return {
    data: null,
    error: `Gemini API error in ${functionName} (Last model: ${lastModelUsed}): ${errorMessage}`,
    metadata: {
      promptSent: fullPromptForLogging,
      rawResponse: JSON.stringify(lastError, Object.getOwnPropertyNames(lastError)),
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
  const prompt = `Player arrives at "${locationName}". Context: ${context}. Provide an EXTREMELY BRIEF description (1-2 sentences MAX) of the area's key features.`;

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
  const prompt = `Player (${playerContext}) has moved to a new spot.
    Location: A wilderness area at sub-tile (${subMapCoords.x},${subMapCoords.y}) within world sector (${worldMapCoords.x},${worldMapCoords.y}).
    Biome: ${biomeName}.
    Broader Context: ${worldMapTileTooltip || 'No additional context.'}
    Provide a brief, 2-3 sentence description.`;

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
  const systemInstruction = isCustomGeminiAction
    ? "You are a Dungeon Master narrating the outcome of a player's specific, creative action. Maintain continuity with Recent Events if provided. If the action contradicts the setting, describe the failure. The response should be a brief, 2-3 sentence description of what happens next."
    : "You are a Dungeon Master narrating the outcome of a player's action. Maintain continuity with Recent Events if provided. The response should be a brief, 2-3 sentence description.";

  const sanitizedAction = sanitizeAIInput(playerAction);

  const adaptiveModel = chooseModelForComplexity(COMPLEX_MODEL, sanitizedAction); // Default to PRO for quality narration, downgrades if spammy/short

  // Structured prompt construction for better context adherence (Chronicler Learning)
  let prompt = `## PLAYER ACTION\n${sanitizedAction}\n\n## CURRENT CONTEXT\n${context}`;

  if (sanitizedAction.toLowerCase().includes("look around") && worldMapTileTooltip) {
    prompt += `\n\n## BROADER CONTEXT (Look Around)\n${worldMapTileTooltip}`;
  }

  prompt += `\n\n## NARRATIVE GUIDELINES\n- Focus on sensory details (sight, sound, smell).\n- Do not moralize or lecture.\n- Stay in character as the Dungeon Master.\n- Keep response under 3 sentences.`;

  const result = await generateText(prompt, systemInstruction, false, 'generateActionOutcome', devModelOverride, adaptiveModel);

  if (result.data) {
    result.data.text = validateNarrativeResponse(result.data.text);
  }

  // TODO(Linker): Integrate EntityResolverService to validate entities in generated text.
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

  let lastError: any = null;
  let rateLimitHitInChain = false;
  let lastModelUsed = '';

  const adaptiveModel = chooseModelForComplexity(COMPLEX_MODEL, null);
  const initialModel = devModelOverride || adaptiveModel;
  const modelsToTry = [initialModel, ...GEMINI_TEXT_MODEL_FALLBACK_CHAIN.filter(m => m !== initialModel)];

  for (const model of modelsToTry) {
    lastModelUsed = model;
    try {
      const useThinking = model.includes('gemini-2.5') || model.includes('gemini-3');
      const config: any = {
        systemInstruction: systemInstruction,
        tools: [{ googleSearch: {} }],
      };

      if (useThinking) {
        config.thinkingConfig = { thinkingBudget: 32768 };
      }

      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: config,
      });

      const responseText = response.text?.trim();
      let encounter: Monster[] = [];

      if (responseText) {
        try {
          const jsonString = responseText.replace(/```json\n|```/g, '').trim();
          encounter = JSON.parse(jsonString);
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
    } catch (error) {
      lastError = error;
      const errorString = JSON.stringify(error, Object.getOwnPropertyNames(error));
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
  return {
    data: null,
    error: `Failed to generate encounter (Last model: ${lastModelUsed}): ${errorMessage}`,
    metadata: {
      promptSent: fullPromptForLogging,
      rawResponse: JSON.stringify(lastError, Object.getOwnPropertyNames(lastError)),
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
    const jsonString = result.data.text.replace(/```json\n|```/g, '').trim();
    const parsedActions: any[] = JSON.parse(jsonString);

    actions = parsedActions.map(a => ({
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
    const parsed = JSON.parse(result.data.text.replace(/```json\n|```/g, '').trim());
    return {
      data: {
        ...result.data,
        outcomeText: parsed.outcomeText || "The situation evolves...",
        dispositionChange: parsed.dispositionChange || (wasSuccess ? 1 : -1),
        memoryFactText: parsed.memoryFactText || `Player check: ${skillName} (${wasSuccess ? 'Success' : 'Fail'})`,
        goalUpdate: parsed.goalUpdate || null,
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
  devModelOverride: string | null = null
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

  // If the API call itself failed
  if (result.error || !result.data) {
    return {
      data: {
        text: "Failed to generate inventory.",
        promptSent: result.metadata?.promptSent || "",
        rawResponse: result.metadata?.rawResponse || "",
        rateLimitHit: result.metadata?.rateLimitHit,
        inventory: getFallbackInventory(shopType),
        economy: { scarcity: [], surplus: [], sentiment: "neutral" }
      },
      error: result.error,
      metadata: result.metadata
    };
  }

  try {
    const jsonString = result.data.text.replace(/```json\n|```/g, '').trim();
    const parsed = JSON.parse(jsonString);
    return {
      data: {
        ...result.data,
        inventory: parsed.inventory,
        economy: parsed.economy
      },
      error: null
    };
  } catch (e) {
    // If the API succeeded but returned malformed JSON
    logger.warn("Failed to parse inventory JSON. Using fallback.", { error: e });
    return {
      data: {
        ...result.data,
        inventory: getFallbackInventory(shopType),
        economy: { scarcity: [], surplus: [], sentiment: "neutral" }
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
        text: "Failed to harvest.",
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
    const jsonString = result.data.text.replace(/```json\n|```/g, '').trim();
    const items = JSON.parse(jsonString);
    return {
      data: { ...result.data, items },
      error: null
    };
  } catch (e) {
    return {
      data: {
        ...result.data,
        items: []
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
