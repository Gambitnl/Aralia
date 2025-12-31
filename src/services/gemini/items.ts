import { v4 as uuidv4 } from 'uuid';
import { FAST_MODEL, COMPLEX_MODEL } from "../../config/geminiConfig";
import { logger } from "../../utils/logger";
import { safeJSONParse, cleanAIJSON, redactSensitiveData } from "../../utils/securityUtils";
import { SeededRandom } from "../../utils/seededRandom";
import { formatMemoryForAI } from "../../utils/memoryUtils";
import { InventoryResponseSchema, ItemSchema } from "../geminiSchemas";
import { generateText } from "./core";
import { GeminiHarvestData, GeminiInventoryData, GeminiTextData, StandardizedResult } from "./types";
import { EconomyState, GoalStatus, Item, ItemType, NPCMemory } from "../../types";

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

export async function generateMerchantInventory(
  shopType: string,
  context: string,
  economyState: EconomyState,
  devModelOverride: string | null = null,
  seedKey?: string
): Promise<StandardizedResult<GeminiInventoryData>> {
  const systemInstruction = `You are an expert RPG shopkeeper creating a small, coherent shop inventory. Return JSON: { inventory: Item[], economy: EconomyState }. Respect economyState price modifiers.`;

  const prompt = `Shop Type: ${shopType}
Context: ${context}
Economy State: ${JSON.stringify(economyState)}`;

  const result = await generateText(prompt, systemInstruction, true, 'generateMerchantInventory', devModelOverride, COMPLEX_MODEL);

  if (result.error || !result.data) {
    logger.warn("AI failed to generate merchant inventory, using fallback.", { error: result.error });
    return {
      data: {
        inventory: getFallbackInventory(shopType, seedKey),
        economy: economyState,
        promptSent: result.metadata?.promptSent || '',
        rawResponse: result.metadata?.rawResponse || '',
        rateLimitHit: result.metadata?.rateLimitHit,
      },
      error: null,
      metadata: result.metadata
    };
  }

  try {
    const jsonString = cleanAIJSON(result.data.text);
    const parsed = safeJSONParse(jsonString);
    if (!parsed) throw new Error("Parsed JSON is null");
    const validated = InventoryResponseSchema.parse(parsed);

    return {
      data: {
        inventory: validated.inventory,
        economy: validated.economy || economyState,
        promptSent: result.data.promptSent,
        rawResponse: result.data.rawResponse,
        rateLimitHit: result.data.rateLimitHit
      },
      error: null
    };
  } catch (error) {
    logger.error("Failed to parse merchant inventory JSON. Using fallback.", { error: redactSensitiveData(error), response: result.data.text });
    return {
      data: {
        inventory: getFallbackInventory(shopType, seedKey),
        economy: economyState,
        promptSent: result.data.promptSent,
        rawResponse: result.data.rawResponse,
        rateLimitHit: result.data.rateLimitHit
      },
      error: null
    };
  }
}

export async function generateHarvestLoot(
  locationName: string,
  actionDescription: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiHarvestData>> {
  const systemInstruction = `You are generating loot from harvesting in a fantasy RPG. Return JSON: { items: Item[] }. Items should fit the location and action.`;

  const prompt = `Location: ${locationName}
Action: ${actionDescription}
Return a concise loot list.`;

  const result = await generateText(prompt, systemInstruction, true, 'generateHarvestLoot', devModelOverride, COMPLEX_MODEL);

  if (result.error || !result.data) {
    return {
      data: {
        items: [],
        promptSent: result.metadata?.promptSent || "",
        rawResponse: result.metadata?.rawResponse || "",
        rateLimitHit: result.metadata?.rateLimitHit
      },
      error: result.error,
      metadata: result.metadata
    };
  }

  try {
    const jsonString = cleanAIJSON(result.data.text);
    const parsed = safeJSONParse(jsonString);
    if (!parsed) throw new Error("Parsed JSON is null");
    const validated = ItemSchema.array().parse(parsed);
    return {
      data: {
        items: validated,
        promptSent: result.data.promptSent,
        rawResponse: result.data.rawResponse,
        rateLimitHit: result.data.rateLimitHit
      },
      error: null
    };
  } catch (error) {
    logger.error("Failed to parse harvest loot JSON.", { error: redactSensitiveData(error), response: result.data.text });
    return {
      data: {
        items: [],
        promptSent: result.data.promptSent,
        rawResponse: result.data.rawResponse,
        rateLimitHit: result.data.rateLimitHit
      },
      error: "Failed to parse harvest loot JSON.",
      metadata: result.metadata
    };
  }
}

export async function generateGuideResponse(
  memory: NPCMemory,
  goalStatus: GoalStatus,
  playerContext: string,
  devModelOverride: string | null = null
): Promise<StandardizedResult<GeminiTextData>> {
  const systemInstruction = `You role-play a helpful but succinct guide NPC. 1-2 sentences, referencing past memory and current goal status.`;

  const prompt = `NPC Memory: ${formatMemoryForAI(memory)}
Goal Status: ${JSON.stringify(goalStatus)}
Player Context: ${playerContext}

Give a 1-2 sentence guide response that is actionable and concise.`;

  return await generateText(prompt, systemInstruction, false, 'generateGuideResponse', devModelOverride, FAST_MODEL);
}
