
/**
 * @file src/hooks/actions/handleItemInteraction.ts
 * Handles item interaction actions like 'take_item', 'EQUIP_ITEM', etc.
 */
import React from 'react';
import { GameState, Action, EquipItemPayload, UnequipItemPayload, UseItemPayload, DropItemPayload, DiscoveryType, DiscoveryEntry } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { AddMessageFn, AddGeminiLogFn } from './actionHandlerTypes';
import { ITEMS, LOCATIONS, SKILLS_DATA } from '../../constants';
import * as GeminiService from '../../services/geminiService';
import { getAbilityModifierValue } from '../../utils/characterUtils';
import { INITIAL_QUESTS } from '../../data/quests';

interface HandleTakeItemProps {
  action: Action;
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
}

export async function handleTakeItem({
  action,
  gameState,
  dispatch,
  addMessage,
}: HandleTakeItemProps): Promise<void> {
  if (!action.targetId) {
    addMessage("Invalid item target.", "system");
    dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
    return;
  }
  const itemToTake = ITEMS[action.targetId];
  const currentLocId = gameState.currentLocationId;
  if (currentLocId.startsWith('coord_')) {
    addMessage(`There are no specific items to take in this wilderness area.`, 'system');
    dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
    return;
  }
  const itemsCurrentlyInLoc = gameState.dynamicLocationItemIds[currentLocId] || [];
  
  if (itemToTake && itemsCurrentlyInLoc.includes(action.targetId)) {
    // Create the discovery entry here in the handler
    const newDiscoveryEntry: DiscoveryEntry = {
        id: crypto.randomUUID(),
        gameTime: gameState.gameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
        type: DiscoveryType.ITEM_ACQUISITION,
        title: `Item Acquired: ${itemToTake.name}`,
        content: `You found and picked up ${itemToTake.name}. ${itemToTake.description}`,
        source: { type: 'LOCATION', id: currentLocId, name: LOCATIONS[currentLocId]?.name },
        flags: [{ key: 'itemId', value: itemToTake.id, label: itemToTake.name }],
        timestamp: Date.now(),
        isRead: false,
    };

    // Dispatch the update action with the full payload
    dispatch({ 
        type: 'APPLY_TAKE_ITEM_UPDATE', 
        payload: { 
            item: itemToTake, 
            locationId: currentLocId,
            discoveryEntry: newDiscoveryEntry
        } 
    });
    addMessage(`You take the ${itemToTake.name}.`, 'system');

    // TODO(FEATURES): Swap hardcoded item quest triggers for data-driven quest hooks tied to item metadata (see docs/FEATURES_TODO.md; if this block is moved/refactored/modularized, update the FEATURES_TODO entry path).
    // Check for quest triggers based on item ID
    if (action.targetId === 'old_map_fragment') {
       // Trigger 'The Lost Map' quest if not already active/completed
       const questId = 'lost_map';
       const quest = INITIAL_QUESTS[questId];
       if (quest && !gameState.questLog.some(q => q.id === questId)) {
           dispatch({ type: 'ACCEPT_QUEST', payload: quest });
           // Also immediately complete the objective "find_map"
           dispatch({ type: 'UPDATE_QUEST_OBJECTIVE', payload: { questId, objectiveId: 'find_map', isCompleted: true } });
       } else if (gameState.questLog.some(q => q.id === questId)) {
           dispatch({ type: 'UPDATE_QUEST_OBJECTIVE', payload: { questId, objectiveId: 'find_map', isCompleted: true } });
       }
    }
  } else {
    addMessage(`Cannot take ${ITEMS[action.targetId]?.name || action.targetId}. It's not here or doesn't exist.`, 'system');
  }
  dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
  dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
}

export function handleEquipItem(dispatch: React.Dispatch<AppAction>, payload: EquipItemPayload): void {
  dispatch({ type: 'EQUIP_ITEM', payload });
}

export function handleUnequipItem(dispatch: React.Dispatch<AppAction>, payload: UnequipItemPayload): void {
  dispatch({ type: 'UNEQUIP_ITEM', payload });
}

export function handleUseItem(dispatch: React.Dispatch<AppAction>, payload: UseItemPayload): void {
  dispatch({ type: 'USE_ITEM', payload });
}

export function handleDropItem(dispatch: React.Dispatch<AppAction>, payload: DropItemPayload): void {
  dispatch({ type: 'DROP_ITEM', payload });
}


interface HandleHarvestProps {
    action: Action;
    gameState: GameState;
    dispatch: React.Dispatch<AppAction>;
    addMessage: AddMessageFn;
    addGeminiLog: AddGeminiLogFn;
}

export async function handleHarvestResource({
    action,
    gameState,
    dispatch,
    addMessage,
    addGeminiLog
}: HandleHarvestProps): Promise<void> {
    const { harvestContext } = action.payload || {};
    const player = gameState.party[0];
    
    if (!player) return;

    const survivalSkill = SKILLS_DATA['survival'];
    const natureSkill = SKILLS_DATA['nature'];
    
    const survivalBonus = getAbilityModifierValue(player.finalAbilityScores[survivalSkill.ability]) + (player.skills.some(s => s.id === 'survival') ? (player.proficiencyBonus || 2) : 0);
    const natureBonus = getAbilityModifierValue(player.finalAbilityScores[natureSkill.ability]) + (player.skills.some(s => s.id === 'nature') ? (player.proficiencyBonus || 2) : 0);
    
    const bonus = Math.max(survivalBonus, natureBonus);
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + bonus;
    
    const usedSkillName = survivalBonus > natureBonus ? 'Survival' : 'Nature';
    
    addMessage(`You attempt to harvest resources from the ${harvestContext || 'area'}... (${usedSkillName} check: ${roll} + ${bonus} = ${total})`, 'system');
    
    const biome = 'wilds';
    if (gameState.currentLocationId.startsWith('coord_')) {
         // Logic to get biome from map data if needed
    }

    dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: "Harvesting..." } });

    const lootResult = await GeminiService.generateHarvestLoot(harvestContext || 'local flora/fauna', biome, total, gameState.devModelOverride);
    
    addGeminiLog('generateHarvestLoot', lootResult.data?.promptSent || lootResult.metadata?.promptSent || "", lootResult.data?.rawResponse || lootResult.metadata?.rawResponse || lootResult.error || "");
    
    if (lootResult.data?.items && lootResult.data.items.length > 0) {
        const items = lootResult.data.items;
        addMessage(`Success! You found: ${items.map(i => i.name).join(', ')}.`, 'system');
        
        items.forEach(item => {
             dispatch({ type: 'BUY_ITEM', payload: { item, cost: 0 } }); 
             
             dispatch({ 
                type: 'ADD_DISCOVERY_ENTRY', 
                payload: {
                    id: crypto.randomUUID(),
                    gameTime: gameState.gameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
                    type: DiscoveryType.HARVEST,
                    title: `Harvested: ${item.name}`,
                    content: `You successfully harvested ${item.name}. ${item.description}`,
                    source: { type: 'PLAYER_ACTION', name: 'Harvest' },
                    flags: [{key: 'itemId', value: item.id, label: item.name}],
                    timestamp: Date.now(),
                    isRead: false
                }
            });
        });

    } else {
        addMessage("You fail to find anything useful.", 'system');
    }
    
    dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
}
