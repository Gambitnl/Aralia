import { GenerationConfig } from "@google/genai";
import { ai } from "../aiClient";
import { getFallbackEncounter } from "../geminiServiceFallback";
import { CLASSES_DATA } from "../../data/classes";
import { sanitizeAIInput, cleanAIJSON, safeJSONParse, redactSensitiveData } from "../../utils/securityUtils";
import { logger } from "../../utils/logger";
import { GEMINI_TEXT_MODEL_FALLBACK_CHAIN, COMPLEX_MODEL } from "../../config/geminiConfig";
import { MonsterSchema, CustomActionSchema, SocialOutcomeSchema } from "../geminiSchemas";
import { chooseModelForComplexity, generateText } from "./core";
import { ExtendedGenerationConfig, GeminiCustomActionData, GeminiEncounterData, GeminiMetadata, GeminiSocialCheckData, GeminiTextData, StandardizedResult } from "./types";
import { Action, GroundingChunk, InspectSubmapTilePayload, Monster, NPCMemory, TempPartyMember, VillageActionContext } from "../../types";
import { SUBMAP_ICON_MEANINGS } from "../../data/glossaryData";

export async function generateOracleResponse(
  playerQuery: string,
  context: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiTextData>> {
  const systemInstruction = "You are the Oracle, a mysterious, wise entity. Respond to the player's query. Your response MUST be enigmatic and brief (1-2 sentences MAX). Speak in the first person. Do NOT give a direct answer; provide a cryptic clue.";

  const sanitizedQuery = sanitizeAIInput(playerQuery);

  const adaptiveModel = chooseModelForComplexity(COMPLEX_MODEL, sanitizedQuery);

  const prompt = `A player asks me, the Oracle: "${sanitizedQuery}"
My context: ${context}
My brief, cryptic, first-person response is:`;
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
  const result = await generateText(prompt, "You are a fantasy name generator.", false, 'generateCharacterName', devModelOverride, GEMINI_TEXT_MODEL_FALLBACK_CHAIN[0]);

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
  context: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiTextData>> {
  const systemInstruction = `You are a Dungeon Master describing what a player character observes when they carefully inspect a nearby area in a fantasy RPG. Your response must be an evocative, 2-3 sentence description. CRITICAL: Do NOT use game jargon. Focus on sensory details. Use the Atmosphere and Location context to ground the description.`;

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

  const prompt = `${context}

## INSPECTION TARGET
The character is closely inspecting a specific spot nearby.
- General Biome: ${tileDetails.worldBiomeId}
- Terrain Type: ${terrainContext}
- The spot contains: ${featureContext}

## TASK
Describe what the character sees, hears, or smells at this specific spot in 2-3 sentences. Ensure the description matches the Atmosphere & Environment described in the context (e.g. if it's raining, the spot is wet).`;

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

  if (!ai) {
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

  const adaptiveModel = chooseModelForComplexity(COMPLEX_MODEL, null);
  const initialModel = devModelOverride || adaptiveModel;
  const modelsToTry = [initialModel, ...GEMINI_TEXT_MODEL_FALLBACK_CHAIN.filter(m => m !== initialModel)];

  for (const model of modelsToTry) {
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
        config: config as unknown as GenerationConfig,
      });

      const responseText = response.text?.trim();
      let encounter: Monster[] = [];

      if (responseText) {
        try {
          const jsonString = cleanAIJSON(responseText);
          const parsed = safeJSONParse(jsonString);
          if (!parsed) throw new Error("Parsed JSON is null");
          encounter = MonsterSchema.array().parse(parsed);
        } catch {
          logger.error(`Failed to parse JSON from generateEncounter with model ${model}:`, { responseText });
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
        } catch {
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
    }
  }

  const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);

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
    error: null,
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
        isEgregious: a.isEgregious
      }
    }));
  } catch {
    logger.error("Failed to parse AI response for custom actions. Using fallback.", { response: result.data.text });
    actions = fallbackActions;
  }

  return {
    data: {
      text: result.data.text,
      promptSent: result.data.promptSent,
      rawResponse: result.data.rawResponse,
      rateLimitHit: result.data.rateLimitHit,
      actions
    },
    error: null
  };
}

export async function generateSocialCheckOutcome(
  npcMemory: NPCMemory | null,
  villageContext: VillageActionContext | null,
  playerAction: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiSocialCheckData>> {
  const systemInstruction = `You are a social resolution AI for a fantasy RPG. Based on the player's action and context, provide:
  1) A 1-2 sentence outcome (what the NPC does).
  2) A disposition change between -2 and +2.
  3) A memory fact the NPC records (1 sentence).
  4) An optional goal update (if relevant).`;

  const npcContext = npcMemory ? `NPC Memory: ${npcMemory.facts.join('; ')}` : "NPC Memory: (none)";
  const villageContextStr = villageContext ? `Village Context: ${JSON.stringify(villageContext)}` : "Village Context: (none)";

  const prompt = `Player Action: ${playerAction}
${npcContext}
${villageContextStr}`;

  const result = await generateText(prompt, systemInstruction, true, 'generateSocialCheckOutcome', devModelOverride, COMPLEX_MODEL);

  if (result.error || !result.data) {
    return {
      data: null,
      error: result.error,
      metadata: result.metadata
    };
  }

  try {
    const jsonString = cleanAIJSON(result.data.text);
    const parsed = safeJSONParse(jsonString);
    if (!parsed) throw new Error("Parsed JSON is null");
    const validated = SocialOutcomeSchema.parse(parsed);

    return {
      data: {
        text: result.data.text,
        promptSent: result.data.promptSent,
        rawResponse: result.data.rawResponse,
        rateLimitHit: result.data.rateLimitHit,
        outcomeText: validated.outcomeText,
        dispositionChange: validated.dispositionChange,
        memoryFactText: validated.memoryFactText,
        goalUpdate: validated.goalUpdate || null
      },
      error: null
    };
  } catch (error) {
    logger.error("Failed to parse social outcome JSON.", { error: redactSensitiveData(error), response: result.data.text });
    return {
      data: null,
      error: "Failed to parse social outcome JSON.",
      metadata: result.metadata
    };
  }
}
