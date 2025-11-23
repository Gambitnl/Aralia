
/**
 * @file src/hooks/actions/handleMerchantInteraction.ts
 * Handles interactions with dynamic merchants and shops.
 */
import React from 'react';
import { GameState, Action, Item, EconomyState } from '../../types';
import { AppAction } from '../../state/actionTypes';
import * as GeminiService from '../../services/geminiService';
import { AddMessageFn, AddGeminiLogFn } from './actionHandlerTypes';

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
  const inventoryResult = await GeminiService.generateMerchantInventory(villageContext, merchantType, gameState.devModelOverride);
  
  addGeminiLog('generateMerchantInventory', inventoryResult.data?.promptSent || inventoryResult.metadata?.promptSent || "", inventoryResult.data?.rawResponse || inventoryResult.metadata?.rawResponse || inventoryResult.error || "");
  
  if (inventoryResult.data?.rateLimitHit || inventoryResult.metadata?.rateLimitHit) {
    dispatch({ type: 'SET_RATE_LIMIT_ERROR_FLAG' });
  }

  if (inventoryResult.data) {
      const { inventory, economy } = inventoryResult.data;
      
      // 2. Open modal with generated data
      dispatch({ 
          type: 'OPEN_MERCHANT', 
          payload: { 
              merchantName: merchantType, 
              inventory: inventory,
              economy: economy
          } 
      });
      addMessage(`You browse the wares at the ${merchantType}.`, "system");
  } else {
      addMessage("The shop seems closed or empty right now.", "system");
      console.error("Failed to generate inventory:", inventoryResult.error);
  }

  dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
}
