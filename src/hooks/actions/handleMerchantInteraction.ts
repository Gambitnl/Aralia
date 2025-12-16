
/**
 * @file src/hooks/actions/handleMerchantInteraction.ts
 * Handles interactions with dynamic merchants and shops.
 */
import React from 'react';
import { GameState, Action, Item, EconomyState, VillageActionContext } from '../../types';
import { AppAction } from '../../state/actionTypes';
import * as GeminiService from '../../services/geminiService';
import { AddMessageFn, AddGeminiLogFn } from './actionHandlerTypes';
import { applyEventsToEconomy, generateMarketEvents } from '@/utils/economyUtils';

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
  // Casting keeps us honest about the shape while still letting legacy callers
  // omit the village context; the Gemini helper handles missing data
  // gracefully when building prompts.
  const contextForPrompt = villageContext as VillageActionContext | undefined;
  if (contextForPrompt) {
    // Share a quick blurb with the player so they understand why a merchant's
    // stock skews a certain way (e.g., arid martial village favors weapons).
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

      // 3. Apply Simulated World Events to Economy
      // We generate events deterministically based on game time (epoch) to ensure consistency for now,
      // but in the future this could be pulled from global GameState events.
      const currentEvents = generateMarketEvents(gameState.gameTime.getTime());

      const modifiedEconomy = economy
        ? applyEventsToEconomy(economy, currentEvents)
        : applyEventsToEconomy({ marketFactors: { scarcity: [], surplus: [] }, buyMultiplier: 1, sellMultiplier: 0.5 }, currentEvents);

      // Notify player of active events affecting prices
      if (currentEvents.length > 0) {
        const eventNames = currentEvents.map(e => e.name).join(', ');
        addMessage(`Market News: ${eventNames} are affecting prices.`, 'system');
      }
      
      // 2. Open modal with generated data
      dispatch({ 
          type: 'OPEN_MERCHANT', 
          payload: { 
              merchantName: merchantType, 
              inventory: inventory,
              economy: modifiedEconomy
          } 
      });
      addMessage(`You browse the wares at the ${merchantType}.`, "system");
  } else {
      addMessage("The shop seems closed or empty right now.", "system");
      console.error("Failed to generate inventory:", inventoryResult.error);
  }

  dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
}
