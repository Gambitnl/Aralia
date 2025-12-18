
/**
 * @file src/hooks/actions/handleMerchantInteraction.ts
 * Handles interactions with dynamic merchants and shops.
 */
import React from 'react';
import { GameState, Action, Item, EconomyState, VillageActionContext } from '../../types';
import { AppAction } from '../../state/actionTypes';
import * as GeminiService from '../../services/geminiService';
import { AddMessageFn, AddGeminiLogFn } from './actionHandlerTypes';
// import { applyEventsToEconomy, generateMarketEvents } from '@/utils/economyUtils'; // Removed as functions no longer exist in updated utils

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
  const { merchantType, villageContext } = action.payload || {};
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
  const inventoryResult = await GeminiService.generateMerchantInventory(
    contextForPrompt,
    merchantType,
    gameState.devModelOverride
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
