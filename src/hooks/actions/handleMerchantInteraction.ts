
/**
 * @file src/hooks/actions/handleMerchantInteraction.ts
 * Handles interactions with dynamic merchants and shops.
 */
import React from 'react';
import { GameState, Action, VillageActionContext, PlayerCharacter, Skill } from '../../types';
import { AppAction } from '../../state/actionTypes';
import * as GeminiService from '../../services/geminiService';
import { AddMessageFn, AddGeminiLogFn } from './actionHandlerTypes';
import { calculatePrice } from '../../utils/economy/economyUtils';
import { generateNPC, NPCGenerationConfig } from '../../services/npcGenerator';

/**
 * Validates a merchant transaction (buy/sell) before dispatching to the reducer.
 * Ensures the player has enough gold for purchases and the item exists for sales.
 * 
 * @param type 'buy' or 'sell'
 * @param payload The transaction payload containing item and cost/value
 * @param gameState Current game state for gold and inventory checks
 * @returns { valid: boolean; error?: string }
 */
export function validateMerchantTransaction(
  type: 'buy' | 'sell',
  payload: { item?: any; cost?: number; itemId?: string; value?: number },
  gameState: GameState
): { valid: boolean; error?: string } {
  if (type === 'buy') {
    const { item, cost } = payload;
    if (!item) return { valid: false, error: "No item specified for purchase." };
    if (typeof cost !== 'number' || cost < 0) return { valid: false, error: "Invalid purchase cost." };
    if (gameState.gold < cost) {
      return { valid: false, error: `Insufficient gold. Need ${cost} GP, but you only have ${gameState.gold} GP.` };
    }
  } else if (type === 'sell') {
    const { itemId, value } = payload;
    if (!itemId) return { valid: false, error: "No item specified for sale." };
    if (typeof value !== 'number' || value < 0) return { valid: false, error: "Invalid sale value." };

    const hasItem = gameState.inventory.some(i => i.id === itemId);
    if (!hasItem) {
      return { valid: false, error: "Item not found in inventory." };
    }
  }
  return { valid: true };
}

interface HandleMerchantInteractionProps {
  action: Action;
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  addGeminiLog: AddGeminiLogFn;
  generalActionContext: string;
}

export async function handleOpenDynamicMerchant({
  action,
  gameState,
  dispatch,
  addMessage,
  addGeminiLog,
  generalActionContext,
}: HandleMerchantInteractionProps): Promise<void> {
  const payload = action.payload as { merchantType: string; villageContext?: VillageActionContext; buildingId?: string; seedKey?: string };
  const { merchantType, villageContext, buildingId, seedKey } = payload || {};
  if (!merchantType) {
    addMessage("Invalid merchant data.", "system");
    return;
  }

  dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: `Entering ${merchantType}...` } });

  // --- NPC Population Logic ---
  // If we have a stable buildingId, we check if an NPC lives here.
  // If not, we generate one and persist them.
  let merchantName = merchantType; // Default fallback
  const resolvedBuildingId = (typeof buildingId === 'string' && buildingId) ||
    (typeof (villageContext as VillageActionContext)?.buildingId === 'string' ? (villageContext as VillageActionContext).buildingId : undefined);

  if (resolvedBuildingId) {
    // Check registry
    let npc = gameState.generatedNpcs?.[resolvedBuildingId];

    if (!npc) {
      // Generate new Merchant NPC
      const config: NPCGenerationConfig = {
        id: resolvedBuildingId, // Use building ID as NPC ID for simple 1-to-1 mapping
        role: 'merchant',
        occupation: merchantType.replace('shop_', '').replace('_', ' '), // e.g. shop_blacksmith -> blacksmith
        // TODO: In future, derive race/level from Town data (wealth/biome)
      };

      npc = generateNPC(config);

      // Persist to state
      dispatch({ type: 'REGISTER_GENERATED_NPC', payload: { npc } });
      addMessage(`A new face greets you: ${npc.name}, the ${npc.biography.age}-year-old ${npc.biography.classId}.`, 'system');
    } else {
      addMessage(`You recognize ${npc.name}.`, 'system');
    }

    // Use the generated name for the UI
    merchantName = `${npc.name} (${merchantType})`;
  }

  // 1. Generate inventory using Gemini
  const contextForPrompt = villageContext as VillageActionContext | undefined;
  if (contextForPrompt) {
    addMessage(
      contextForPrompt.integrationTagline || 'The shop reflects the settlement around it.',
      'system'
    );
  }

  // TownCanvas interactions often provide `buildingId` but not a full VillageActionContext.
  // We still want deterministic fallback inventories per-building (when AI is off / fails),
  // so we pass a stable seed hint through to the generator.
  const resolvedSeedKey = (typeof seedKey === 'string' && seedKey) || resolvedBuildingId;

  const inventoryResult = await GeminiService.generateMerchantInventory(
    merchantType,
    contextForPrompt?.integrationTagline || generalActionContext,
    gameState.economy || { activeEvents: [] } as any,
    gameState.devModelOverride ?? null,
    resolvedSeedKey
  );

  addGeminiLog('generateMerchantInventory', inventoryResult.data?.promptSent || inventoryResult.metadata?.promptSent || "", inventoryResult.data?.rawResponse || inventoryResult.metadata?.rawResponse || inventoryResult.error || "");

  if (inventoryResult.data?.rateLimitHit || inventoryResult.metadata?.rateLimitHit) {
    dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
  }

  if (inventoryResult.data) {
    const { inventory, economy: _economy } = inventoryResult.data;

    // Use global economy logic instead of generating local events
    // We pass the global economy state if available, or the one returned by Gemini
    // But actually, we should prioritize the global state since that's where the persistent events live.
    // However, if Gemini returned specific economy tweaks for this specific merchant, maybe we should merge them?
    // For now, let's trust the global state managed by WorldEventManager.

    // Employ economyUtils: Check if the global economy has active modifiers
    const activeEvents = gameState.economy?.activeEvents || [];
    if (activeEvents.length > 0) {
      addMessage(`Market Alert: ${activeEvents.length} active events are influencing prices.`, "system");

      // Example check: Price of a generic item to see multiplier
      if (inventory.length > 0) {
        const samplePrice = calculatePrice(inventory[0], gameState.economy, 'buy');
        if (samplePrice.isModified) {
          addMessage(`(Prices are currently ${samplePrice.multiplier > 1 ? 'high' : 'low'})`, "system");
        }
      }
    }

    dispatch({
      type: 'OPEN_MERCHANT',
      payload: {
        merchantName: merchantName,
        inventory: inventory,
        economy: gameState.economy // Prioritize global world state
      }
    });
    addMessage(`You browse the wares at the ${merchantType}.`, "system");
  } else {
    addMessage("The shop seems closed or empty right now.", "system");
    console.error("Failed to generate inventory:", inventoryResult.error);
  }

  dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
}

/**
 * Helper to calculate a character's skill modifier.
 */
function calculateSkillModifier(character: PlayerCharacter, skillId: string): number {
  const abilities = character.finalAbilityScores;
  const abilityName = skillId === 'Intimidation' ? 'Charisma' :
    skillId === 'Persuasion' ? 'Charisma' :
      skillId === 'Insight' ? 'Wisdom' :
        skillId === 'Investigation' ? 'Intelligence' : 'Charisma';

  const score = abilities[abilityName as keyof typeof abilities] || 10;
  const modifier = Math.floor((score - 10) / 2);
  const proficiency = character.proficiencyBonus || 2;

  // Basic check: is the skill in the character's skill list?
  const isProficient = character.skills.some((s: Skill) => s.name === skillId || s.id === skillId);

  return modifier + (isProficient ? proficiency : 0);
}

export async function handleMerchantAction({
  action,
  gameState,
  dispatch,
  addMessage,
}: HandleMerchantInteractionProps): Promise<void> {
  const payload = action.payload as import('../../types').MerchantActionPayload;
  const { strategy, transaction, merchantId, priceMultiplier } = payload;

  if (action.type === 'HAGGLE_ITEM') {
    // Validate merchantId is present for haggle persistence
    if (!merchantId) {
      addMessage('Cannot haggle: merchant identification failed.', 'system');
      return;
    }

    // HAGGLE PERSISTENCE: Check for recent_haggle in npcMemory
    const npcMemory = gameState.npcMemory?.[merchantId];
    const hasRecentHaggle = npcMemory?.knownFacts?.some(
      (fact) => fact.id === 'recent_haggle'
    );
    if (hasRecentHaggle) {
      addMessage(
        'You already haggled with this merchant recently. Give them time to forget.',
        'system'
      );
      return;
    }

    const interactor =
      gameState.party.find((p) => p.id === payload.interactorId) ||
      gameState.party[0];
    const skillName =
      strategy === 'intimidate'
        ? 'Intimidation'
        : strategy === 'insight'
          ? 'Insight'
          : strategy === 'appraise'
            ? 'Investigation'
            : 'Persuasion';

    const modifier = calculateSkillModifier(interactor, skillName);
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + modifier;

    // DYNAMIC DC: Calculate based on merchant level, local heat, and reputation
    const merchantNpc = gameState.generatedNpcs?.[merchantId];
    const merchantLevel = merchantNpc?.biography?.level ?? 1;
    const localHeat =
      gameState.notoriety?.localHeat?.[gameState.currentLocationId] ?? 0;
    const localHeatPenalty = Math.floor(localHeat / 10);

    // Calculate reputation bonus from faction standings (average standing / 10)
    const factionStandings = Object.values(
      gameState.playerFactionStandings ?? {}
    );
    const avgReputation =
      factionStandings.length > 0
        ? factionStandings.reduce((sum, fs) => sum + (fs.publicStanding ?? 0), 0) /
          factionStandings.length
        : 0;
    const reputationBonus = Math.floor(avgReputation / 10);

    const dc = 10 + merchantLevel * 2 + localHeatPenalty - reputationBonus;

    const success = total >= dc;
    const margin = total - dc;

    // Calculate price multiplier based on strategy and success
    let calculatedPriceMultiplier = 1.0;
    if (success) {
      if (strategy === 'intimidate') {
        calculatedPriceMultiplier = 0.8; // 20% discount
      } else if (strategy === 'insight') {
        calculatedPriceMultiplier = 0.9; // 10% discount
      } else {
        calculatedPriceMultiplier = 0.9; // 10% discount for persuade
      }
    } else {
      if (strategy === 'intimidate') {
        calculatedPriceMultiplier = 1.1; // 10% price increase
      }
    }

    // Store haggle result in payload for BUY_ITEM to use
    (payload as { hagglePriceMultiplier?: number }).hagglePriceMultiplier =
      calculatedPriceMultiplier;

    if (success) {
      let benefit = '';
      if (strategy === 'intimidate') {
        benefit = 'You cow the merchant into a significant 20% discount!';
      } else if (strategy === 'insight') {
        benefit = 'You spot a flaw in the merchant\'s pitch and secure a 10% discount.';
      } else {
        benefit = 'Your smooth talking earns you a 10% discount.';
      }
      addMessage(
        `${interactor.name} rolled ${total} (DC ${dc}). Success! ${benefit}`,
        'system'
      );
    } else {
      let penalty = '';
      if (strategy === 'intimidate') {
        penalty = 'The merchant is offended by your threats and raises prices by 10%!';
      } else {
        penalty = 'The merchant remains unmoved by your efforts.';
      }
      addMessage(
        `${interactor.name} rolled ${total} (DC ${dc}). Failure. ${penalty}`,
        'system'
      );
    }

    // Record recent haggle in NPC memory
    const haggleFact: import('../../types').KnownFact = {
      id: 'recent_haggle',
      text: `Haggled with ${interactor.name} on ${new Date().toLocaleDateString()}`,
      source: 'direct',
      isPublic: false,
      timestamp: Date.now(),
      strength: 5,
      lifespan: 86400000, // 24 hours in milliseconds
    };
    dispatch({
      type: 'ADD_NPC_KNOWN_FACT',
      payload: { npcId: merchantId, fact: haggleFact },
    });

    // CONSEQUENCES: Intimidation increases localHeat regardless of success
    if (strategy === 'intimidate') {
      dispatch({
        type: 'COMMIT_CRIME',
        payload: {
          type: 'intimidation',
          locationId: gameState.currentLocationId,
          severity: 20,
          witnessed: true,
        },
      });
    }

    // DISPOSITION: Apply nudge based on success margin
    const dispositionNudge = success
      ? Math.min(10, Math.max(2, margin))
      : Math.max(-10, Math.min(-2, margin));
    dispatch({
      type: 'UPDATE_NPC_DISPOSITION',
      payload: { npcId: merchantId, amount: dispositionNudge },
    });

    return;
  }

  if (transaction?.buy) {
    const { item, cost } = transaction.buy;
    // GOLD WIRING: Apply priceMultiplier to calculate final cost
    const haggleMultiplier =
      (payload as { hagglePriceMultiplier?: number }).hagglePriceMultiplier ?? priceMultiplier ?? 1.0;
    const finalCost = Math.floor(cost * haggleMultiplier);

    const validation = validateMerchantTransaction('buy', { item, cost: finalCost }, gameState);
    if (validation.valid) {
      dispatch({ type: 'BUY_ITEM', payload: { item, cost: finalCost } });
      addMessage(
        `You purchased ${item.name} for ${finalCost} gold${haggleMultiplier < 1 ? ' (discounted)' : haggleMultiplier > 1 ? ' (increased)' : ''}.`,
        'system'
      );
    } else {
      addMessage(validation.error || 'Purchase failed.', 'system');
    }
  }

  if (transaction?.sell) {
    const { itemId, value } = transaction.sell;
    const validation = validateMerchantTransaction('sell', { itemId, value }, gameState);
    if (validation.valid) {
      dispatch({ type: 'SELL_ITEM', payload: { itemId, value } });
      addMessage(`You sold an item for ${value} gold.`, 'system');
    } else {
      addMessage(validation.error || 'Sale failed.', 'system');
    }
  }

  if (transaction?.barter) {
    addMessage('The merchant considers your items...', 'system');
    addMessage('Bartering system is coming soon to the Aralia UI.', 'system');
  }
}
