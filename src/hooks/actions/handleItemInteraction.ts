// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:28:12
 * Dependents: actionHandlers.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/hooks/actions/handleItemInteraction.ts
 * Handles item interaction actions like 'take_item', 'EQUIP_ITEM', etc.
 */
import React from 'react';
import { GameState, Action, EquipItemPayload, UnequipItemPayload, UseItemPayload, UseHealersKitPayload, DropItemPayload, DiscoveryType, DiscoveryEntry, Item } from '../../types';
import { AppAction } from '../../state/actionTypes';
import { AddMessageFn, AddGeminiLogFn } from './actionHandlerTypes';
import { ITEMS, LOCATIONS } from '../../constants';
import { SKILLS_DATA } from '../../data/skills';
import * as OllamaTextService from '../../services/ollamaTextService';
import * as GeminiService from '../../services/geminiService';
import { getAbilityModifierValue } from '../../utils/character';
import { INITIAL_QUESTS } from '../../data/quests';
import { biomeIdForCell } from '../../systems/worldforge/local/biomeForCell';
import { generateId } from '../../utils/core/idGenerator';
import { forageWilderness } from '../../systems/exploration/forage';
import { isWildernessLocationId } from '../../utils/location/cellLocationId';
import { resolveHealersKitUse, HEALERS_KIT_ITEM_ID } from '../../systems/healing/healersKit';

/**
 * Narrowed action aliases. The handler registry is typed against the whole
 * `Action` union, so these handlers used to reach their own payload through a
 * cast. Pinning each props interface to the matching union member instead lets
 * the discriminant do the work, and keeps the payload contract visible at the
 * function boundary. Callers narrow on `action.type` before calling in.
 */
type TakeItemAction = Extract<Action, { type: 'take_item' }>;
type HarvestResourceAction = Extract<Action, { type: 'HARVEST_RESOURCE' }>;

interface HandleTakeItemProps {
  action: TakeItemAction;
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
}

/**
 * Starts the quest an item's data hooks to the given interaction.
 *
 * The hook is plain item metadata (Item.questHooks), so a new quest-bearing item
 * is authored in the item registry and needs no handler change. ACCEPT_QUEST is
 * the only quest-start seam in the app; the quest reducer drops a quest that is
 * already in the log, so firing a hook twice is harmless. When the hook names a
 * completesObjective, the interaction itself satisfies that objective and it is
 * marked complete alongside the accept.
 */
export function fireItemQuestHook(
  dispatch: React.Dispatch<AppAction>,
  item: Item | undefined,
  hook: 'onUse' | 'onPickup'
): void {
  const questId = item?.questHooks?.[hook];
  if (!questId) return;

  const quest = INITIAL_QUESTS[questId];
  if (!quest) {
    console.warn(`[questHooks] Item "${item?.id}" hooks ${hook} to unknown quest "${questId}".`);
    return;
  }

  dispatch({ type: 'ACCEPT_QUEST', payload: quest });

  const objectiveId = item?.questHooks?.completesObjective;
  if (objectiveId) {
    dispatch({ type: 'UPDATE_QUEST_OBJECTIVE', payload: { questId, objectiveId, isCompleted: true } });
  }
}

export async function handleTakeItem({
  action,
  gameState,
  dispatch,
  addMessage,
}: HandleTakeItemProps): Promise<void> {
  // `take_item` declares an optional `targetId` alongside its payload, so the
  // narrowed action type exposes it directly. Preserved: callers that omit it
  // still fall through to the "Invalid item target." branch below.
  const targetId = action.targetId;

  if (!targetId) {
    addMessage("Invalid item target.", "system");
    dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
    return;
  }
  const itemToTake = ITEMS[targetId];
  const currentLocId = gameState.currentLocationId;
  // NOTE: coord_ (wilderness) tiles previously hard-rejected ALL take_item here,
  // before the placed-item check below — so even items foraged onto a tile (via
  // "Search the Area" → PLACE_AREA_ITEMS) could never be picked up. We now run the
  // same placed-item lookup for every location; the friendly wilderness wording is
  // deferred to the not-found branch when a coord tile genuinely holds nothing.
  const itemsCurrentlyInLoc = gameState.dynamicLocationItemIds[currentLocId] || [];

  if (itemToTake && itemsCurrentlyInLoc.includes(targetId)) {
    // Create the discovery entry here in the handler
    const newDiscoveryEntry: DiscoveryEntry = {
      id: generateId(),
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

    fireItemQuestHook(dispatch, itemToTake, 'onPickup');
  } else if (isWildernessLocationId(currentLocId)) {
    addMessage(`There is nothing like that to take here.`, 'system');
  } else {
    addMessage(`Cannot take ${ITEMS[targetId]?.name || targetId}. It's not here or doesn't exist.`, 'system');
  }
  dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
  dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
}

interface HandleSearchAreaProps {
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
}

/**
 * "Search the Area" — the wilderness loot affordance for procedural coord_ tiles.
 *
 * Named locations carry authored `itemIds`; coord_ tiles do not, so without this a
 * player exploring the map can never pick anything up. This runs a deterministic,
 * biome-biased forage (no AI dependency — see systems/exploration/forage.ts), places
 * any finds onto the tile via PLACE_AREA_ITEMS (which the player then collects with
 * the normal Take buttons), and marks the tile searched so it cannot be farmed.
 */
export async function handleSearchArea({
  gameState,
  dispatch,
  addMessage,
}: HandleSearchAreaProps): Promise<void> {
  const locId = gameState.currentLocationId;
  if (!isWildernessLocationId(locId)) {
    addMessage('You can only forage out in the wilds.', 'system');
    dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
    return;
  }

  // Key presence (even an empty array) means this tile was already foraged.
  if (gameState.dynamicLocationItemIds[locId] !== undefined) {
    addMessage('You have already searched this area thoroughly; there is nothing more to find here.', 'system');
    dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
    return;
  }

  // Grid retirement: forage is seeded by position. A legacy coord_X_Y id keeps its
  // x,y; a cell_<id> id seeds off the cell id. Biome is cell-native.
  const legacy = /^coord_(\d+)_(\d+)$/.exec(locId);
  const x = legacy ? Number(legacy[1]) : (gameState.playerCell?.cellId ?? 0);
  const y = legacy ? Number(legacy[2]) : 0;
  const biomeId = gameState.playerCell?.cellId != null
    ? biomeIdForCell(gameState.worldSeed ?? 0, gameState.playerCell.cellId)
    : undefined;

  const { itemIds } = forageWilderness({ worldSeed: gameState.worldSeed, x, y, biomeId });
  // Defend against a table id that no longer exists in the registry.
  const validIds = itemIds.filter((id) => ITEMS[id]);

  // Always stamp the tile (placing [] when nothing is found) so it reads as searched.
  dispatch({ type: 'PLACE_AREA_ITEMS', payload: { locationId: locId, itemIds: validIds } });

  if (validIds.length === 0) {
    addMessage('You search the surrounding area but turn up nothing of use.', 'system');
  } else {
    const names = validIds.map((id) => ITEMS[id].name).join(', ');
    addMessage(`You search the area and uncover: ${names}.`, 'system');
    dispatch({
      type: 'ADD_DISCOVERY_ENTRY',
      payload: {
        id: generateId(),
        gameTime: gameState.gameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
        type: DiscoveryType.LOCATION_DISCOVERY,
        title: 'Foraged the area',
        content: `Searching the wilds, you found: ${names}.`,
        source: { type: 'PLAYER_ACTION', name: 'Search the Area' },
        flags: validIds.map((id) => ({ key: 'itemId', value: id, label: ITEMS[id].name })),
        timestamp: Date.now(),
        isRead: false,
      },
    });
  }

  // Foraging a tile costs time even when fruitless.
  dispatch({ type: 'ADVANCE_TIME', payload: { seconds: 1800 } });
  dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
}

export function handleEquipItem(dispatch: React.Dispatch<AppAction>, payload: EquipItemPayload): void {
  dispatch({ type: 'EQUIP_ITEM', payload });
}

export function handleUnequipItem(dispatch: React.Dispatch<AppAction>, payload: UnequipItemPayload): void {
  dispatch({ type: 'UNEQUIP_ITEM', payload });
}

export function handleUseItem(dispatch: React.Dispatch<AppAction>, payload: UseItemPayload): void {
  dispatch({ type: 'USE_ITEM', payload });
  // The payload carries only the item id, so the hook is read from the registry entry.
  fireItemQuestHook(dispatch, ITEMS[payload.itemId], 'onUse');
}

interface HandleUseHealersKitProps {
  payload: UseHealersKitPayload;
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
}

/**
 * Out-of-combat Utilize action with a Healer's Kit.
 *
 * The rules live in src/systems/healing/healersKit.ts; this handler only finds
 * the kit and the two characters, rolls through the resolver, reports the
 * outcome and dispatches the applied result. Rolling here (rather than in the
 * reducer) follows handleShortRest, which also resolves Hit Dice in the handler
 * so the log can show the individual rolls.
 *
 * There is no combat counterpart: the combat ability factory
 * (src/commands/factory/AbilityCommandFactory.ts) has no Utilize or item-use
 * path to hang this on.
 */
export function handleUseHealersKit({
  payload,
  gameState,
  dispatch,
  addMessage,
}: HandleUseHealersKitProps): void {
  const user = gameState.party.find(character => character.id === payload.userCharacterId);
  const target = gameState.party.find(character => character.id === payload.targetCharacterId);

  if (!user || !target) {
    addMessage("Invalid target for the Healer's Kit.", 'system');
    return;
  }

  const kit = gameState.inventory.find(item => item.id === HEALERS_KIT_ITEM_ID || item.name === "Healer's Kit");

  const outcome = resolveHealersKitUse({ user, target, kit });
  addMessage(outcome.message, 'system');

  if (!outcome.ok || !kit) return;

  dispatch({
    type: 'APPLY_HEALERS_KIT',
    payload: {
      kitItemId: kit.id,
      kitUsesRemaining: outcome.kitUsesRemaining,
      targetCharacterId: target.id!,
      stabilized: outcome.stabilized,
      healing: outcome.healing,
      hitPointDice: outcome.hitPointDice,
    },
  });
}

export function handleDropItem(dispatch: React.Dispatch<AppAction>, payload: DropItemPayload): void {
  dispatch({ type: 'DROP_ITEM', payload });
}


interface HandleHarvestProps {
  action: HarvestResourceAction;
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
  const payload = action.payload;
  const harvestContext = payload?.harvestContext;
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
  if (isWildernessLocationId(gameState.currentLocationId)) {
    // Logic to get biome from map data if needed
  }

  dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: "Harvesting..." } });

  const lootResult = await GeminiService.generateHarvestLoot(
    harvestContext || 'local flora/fauna',
    `Biome: ${biome}; harvest check total=${total}`,
    gameState.devModelOverride ?? null
  );

  addGeminiLog('generateHarvestLoot', lootResult.data?.promptSent || lootResult.metadata?.promptSent || "", lootResult.data?.rawResponse || lootResult.metadata?.rawResponse || lootResult.error || "");

  if (lootResult.data?.items && lootResult.data.items.length > 0) {
    const items = lootResult.data.items;
    addMessage(`Success! You found: ${items.map(i => i.name).join(', ')}.`, 'system');

    items.forEach(item => {
      dispatch({ type: 'BUY_ITEM', payload: { item, cost: 0 } });

      dispatch({
        type: 'ADD_DISCOVERY_ENTRY',
        payload: {
          id: generateId(),
          gameTime: gameState.gameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
          type: DiscoveryType.HARVEST,
          title: `Harvested: ${item.name}`,
          content: `You successfully harvested ${item.name}. ${item.description}`,
          source: { type: 'PLAYER_ACTION', name: 'Harvest' },
          flags: [{ key: 'itemId', value: item.id, label: item.name }],
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
