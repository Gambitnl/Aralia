
/**
 * @file src/hooks/actions/handleMerchantInteraction.ts
 * Handles interactions with dynamic merchants and shops.
 */
import React from 'react';
import { GameState, Action, EconomyState, VillageActionContext } from '../../types';
import { AppAction } from '../../state/actionTypes';
import * as GeminiService from '../../services/geminiService';
import { AddMessageFn, AddGeminiLogFn } from './actionHandlerTypes';
import { calculatePrice } from '../../utils/economyUtils';

interface HandleMerchantInteractionProps {
  action: Action;
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  addGeminiLog: AddGeminiLogFn;
}

export async function handleOpenDynamicMerchant({
  action,
  gameState,
  dispatch,
  addMessage,
  addGeminiLog,
}: HandleMerchantInteractionProps): Promise<void> {
  const { merchantType, villageContext, buildingId, seedKey } = action.payload || {};
  if (!merchantType) {
      addMessage("Invalid merchant data.", "system");
      return;
  }

  dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: `Entering ${merchantType}...` } });

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
  const resolvedSeedKey =
    (typeof seedKey === 'string' && seedKey) ||
    (typeof buildingId === 'string' && buildingId) ||
    (typeof (villageContext as any)?.buildingId === 'string' ? (villageContext as any).buildingId : undefined);

  const inventoryResult = await GeminiService.generateMerchantInventory(
    contextForPrompt,
    merchantType,
    gameState.devModelOverride,
    resolvedSeedKey
  );
  
  addGeminiLog('generateMerchantInventory', inventoryResult.data?.promptSent || inventoryResult.metadata?.promptSent || "", inventoryResult.data?.rawResponse || inventoryResult.metadata?.rawResponse || inventoryResult.error || "");
  
  if (inventoryResult.data?.rateLimitHit || inventoryResult.metadata?.rateLimitHit) {
    dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
  }

  if (inventoryResult.data) {
      const { inventory, economy } = inventoryResult.data;

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
              merchantName: merchantType, 
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
