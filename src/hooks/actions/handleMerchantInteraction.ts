
/**
 * @file src/hooks/actions/handleMerchantInteraction.ts
 * Handles interactions with dynamic merchants and shops.
 */
import React from 'react';
import { GameState, Action, VillageActionContext } from '../../types';
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
  const { merchantType, villageContext, buildingId, seedKey } = action.payload || {};
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
