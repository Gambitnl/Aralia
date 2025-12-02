
/**
 * @file src/hooks/useGameActions.ts
 * Custom hook for managing game action processing.
 * This is the refactored version that orchestrates calls to specific action handlers.
 */
import React, { useCallback } from 'react';
import { GameState, Action, NPC, Location, MapTile, PlayerCharacter, GeminiLogEntry, EquipItemPayload, UnequipItemPayload, DropItemPayload, UseItemPayload, ShowEncounterModalPayload, StartBattleMapEncounterPayload, Monster, TempPartyMember, DiscoveryType, KnownFact, QuickTravelPayload, GamePhase, Item, VillageActionContext } from '../types';
import { AppAction } from '../state/actionTypes';
import { ITEMS, BIOMES, LOCATIONS, NPCS, WEAPONS_DATA } from '../constants';
import { DIRECTION_VECTORS, SUBMAP_DIMENSIONS } from '../config/mapConfig';
import * as GeminiService from '../services/geminiService';
import { AddMessageFn, PlayPcmAudioFn, GetCurrentLocationFn, GetCurrentNPCsFn, GetTileTooltipTextFn, AddGeminiLogFn, LogDiscoveryFn } from './actions/actionHandlerTypes';

// Import specific action handlers
import { handleMovement, handleQuickTravel } from './actions/handleMovement';
import { handleLookAround, handleInspectSubmapTile, handleAnalyzeSituation } from './actions/handleObservation';
import { handleTalk } from './actions/handleNpcInteraction';
import { handleTakeItem, handleEquipItem, handleUnequipItem, handleUseItem, handleDropItem, handleHarvestResource } from './actions/handleItemInteraction';
import { handleOracle } from './actions/handleOracle';
import { handleGeminiCustom } from './actions/handleGeminiCustom';
import { handleGenerateEncounter, handleShowEncounterModal, handleHideEncounterModal, handleStartBattleMapEncounter, handleEndBattle } from './actions/handleEncounter';
import { handleCastSpell, handleUseLimitedAbility, handleTogglePreparedSpell, handleLongRest, handleShortRest } from './actions/handleResourceActions';
import { handleOpenDynamicMerchant } from './actions/handleMerchantInteraction';
import {
  handleSaveGame,
  handleGoToMainMenu,
  handleToggleMap,
  handleToggleSubmap,
  handleToggleDevMenu,
  handleToggleDiscoveryLog,
  handleToggleGlossary,
  handleTogglePartyEditor,
  handleTogglePartyOverlay,
  handleToggleNpcTestModal,
  handleToggleLogbook,

  handleToggleGameGuide,
  handleToggleQuestLog
} from './actions/handleSystemAndUi';
import { getDiegeticPlayerActionMessage } from '../utils/actionUtils';
import { getSubmapTileInfo } from '../utils/submapUtils';


interface UseGameActionsProps {
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  playPcmAudio: PlayPcmAudioFn;
  getCurrentLocation: GetCurrentLocationFn;
  getCurrentNPCs: GetCurrentNPCsFn;
  getTileTooltipText: GetTileTooltipTextFn;
}

const formatDuration = (totalSeconds: number): string => {
  if (totalSeconds <= 0) return "a moment";

  const years = Math.floor(totalSeconds / 31536000);
  totalSeconds %= 31536000;
  const months = Math.floor(totalSeconds / 2592000);
  totalSeconds %= 2592000;
  const weeks = Math.floor(totalSeconds / 604800);
  totalSeconds %= 604800;
  const days = Math.floor(totalSeconds / 86400);
  totalSeconds %= 86400;
  const hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  const minutes = Math.floor(totalSeconds / 60);

  const parts = [];
  if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
  if (weeks > 0) parts.push(`${weeks} week${weeks > 1 ? 's' : ''}`);
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);

  return parts.length > 0 ? parts.join(', ') : "less than a minute";
};


export function useGameActions({
  gameState,
  dispatch,
  addMessage,
  playPcmAudio,
  getCurrentLocation,
  getCurrentNPCs,
  getTileTooltipText,
}: UseGameActionsProps) {

  const addGeminiLog = useCallback<AddGeminiLogFn>((functionName, prompt, response) => {
    const logEntry: GeminiLogEntry = {
      timestamp: new Date(),
      functionName,
      prompt,
      response,
    };
    dispatch({ type: 'ADD_GEMINI_LOG_ENTRY', payload: logEntry });
  }, [dispatch]);

  const logDiscovery = useCallback<LogDiscoveryFn>((newLocation: Location) => {
    const alreadyDiscovered = gameState.discoveryLog.some(entry =>
      entry.type === DiscoveryType.LOCATION_DISCOVERY &&
      entry.flags.some(f => f.key === 'locationId' && f.value === newLocation.id)
    );

    if (!alreadyDiscovered) {
      dispatch({
        type: 'ADD_DISCOVERY_ENTRY',
        payload: {
          gameTime: gameState.gameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
          type: DiscoveryType.LOCATION_DISCOVERY,
          title: `Location Discovered: ${newLocation.name}`,
          content: `You have discovered ${newLocation.name}. ${newLocation.baseDescription}`,
          source: { type: 'LOCATION', id: newLocation.id, name: newLocation.name },
          flags: [{ key: 'locationId', value: newLocation.id, label: newLocation.name }],
          isQuestRelated: false,
          associatedLocationId: newLocation.id,
          worldMapCoordinates: newLocation.mapCoordinates,
        }
      });
    }
  }, [gameState.discoveryLog, gameState.gameTime, dispatch]);

  const processAction = useCallback(
    async (action: Action) => {
      const isUiToggle = ['toggle_map', 'toggle_submap_visibility', 'toggle_dev_menu', 'toggle_gemini_log_viewer', 'TOGGLE_DISCOVERY_LOG', 'TOGGLE_GLOSSARY_VISIBILITY', 'HIDE_ENCOUNTER_MODAL', 'SHOW_ENCOUNTER_MODAL', 'toggle_party_editor', 'toggle_party_overlay', 'CLOSE_CHARACTER_SHEET', 'TOGGLE_NPC_TEST_MODAL', 'TOGGLE_LOGBOOK', 'CLOSE_MERCHANT', 'BUY_ITEM', 'SELL_ITEM', 'TOGGLE_GAME_GUIDE', 'TOGGLE_QUEST_LOG'].includes(action.type);
      if (!isUiToggle) {
        dispatch({ type: 'SET_LOADING', payload: { isLoading: true, message: "Processing action..." } });
      }

      dispatch({ type: 'SET_ERROR', payload: null });

      if (action.type !== 'talk' && action.type !== 'inspect_submap_tile') {
        if (gameState.lastInteractedNpcId !== null) {
          dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
        }
      }

      const playerCharacter = gameState.party[0];

      const diegeticMessage = getDiegeticPlayerActionMessage(action, NPCS, LOCATIONS, playerCharacter);
      if (diegeticMessage) {
        addMessage(diegeticMessage, 'player');
      }

      let playerContext = 'An adventurer';
      if (playerCharacter) {
        playerContext = `${playerCharacter.name}, a ${playerCharacter.race.name} ${playerCharacter.class.name}`;
      }

      const currentLoc = getCurrentLocation();
      const npcsInLocation = getCurrentNPCs();
      const itemsInLocationNames = currentLoc.itemIds?.map((id) => ITEMS[id]?.name).filter(Boolean).join(', ') || 'nothing special';

      const submapTileInfo = gameState.subMapCoordinates ? getSubmapTileInfo(gameState.worldSeed, currentLoc.mapCoordinates, currentLoc.biomeId, SUBMAP_DIMENSIONS, gameState.subMapCoordinates) : null;

      const subMapCtx = submapTileInfo ? `You are standing on a '${submapTileInfo.effectiveTerrainType}' tile. ` : '';
      const detailedLocationContext = `${subMapCtx}The location is ${currentLoc.name}. Biome: ${BIOMES[currentLoc.biomeId]?.name || 'Unknown'}. Game Time: ${gameState.gameTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`;
      const generalActionContext = `Player context: ${playerContext}. Location context: ${detailedLocationContext}. NPCs present: ${npcsInLocation.map((n) => n.name).join(', ') || 'no one'}. Visible items: ${itemsInLocationNames}.`;

      try {
        switch (action.type) {
          case 'move':
            if (!playerCharacter) return;
            await handleMovement({ action, gameState, dispatch, addMessage, addGeminiLog, logDiscovery, getTileTooltipText, playerContext, playerCharacter });
            break;
          case 'QUICK_TRAVEL':
            await handleQuickTravel({ action, gameState, dispatch, addMessage });
            break;
          case 'ENTER_VILLAGE':
            dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.VILLAGE_VIEW });
            break;
          case 'look_around':
            await handleLookAround({ gameState, dispatch, addMessage, addGeminiLog, generalActionContext, getTileTooltipText });
            break;
          case 'ANALYZE_SITUATION':
            await handleAnalyzeSituation({ gameState, dispatch, addMessage, addGeminiLog, generalActionContext });
            break;
          case 'talk':
            await handleTalk({ action, gameState, dispatch, addMessage, addGeminiLog, playPcmAudio, playerContext, generalActionContext });
            break;
          case 'take_item':
            await handleTakeItem({ action, gameState, dispatch, addMessage });
            break;
          case 'EQUIP_ITEM':
            handleEquipItem(dispatch, action.payload as EquipItemPayload);
            break;
          case 'UNEQUIP_ITEM':
            handleUnequipItem(dispatch, action.payload as UnequipItemPayload);
            break;
          case 'use_item':
            handleUseItem(dispatch, action.payload as UseItemPayload);
            break;
          case 'DROP_ITEM':
            handleDropItem(dispatch, action.payload as DropItemPayload);
            break;
          case 'ask_oracle':
            await handleOracle({ action, gameState, dispatch, addMessage, addGeminiLog, playPcmAudio, generalActionContext });
            break;
          case 'gemini_custom_action':
            await handleGeminiCustom({ action, gameState, dispatch, addMessage, addGeminiLog, generalActionContext, getCurrentLocation, getCurrentNPCs });
            break;
          case 'inspect_submap_tile':
            await handleInspectSubmapTile({ action, gameState, dispatch, addMessage, addGeminiLog });
            break;
          case 'GENERATE_ENCOUNTER':
            await handleGenerateEncounter({ gameState, dispatch });
            break;
          case 'SHOW_ENCOUNTER_MODAL':
            handleShowEncounterModal(dispatch, action.payload?.encounterData as ShowEncounterModalPayload);
            return;
          case 'HIDE_ENCOUNTER_MODAL':
            handleHideEncounterModal(dispatch);
            return;
          case 'START_BATTLE_MAP_ENCOUNTER':
            handleStartBattleMapEncounter(dispatch, action.payload?.startBattleMapEncounterData as StartBattleMapEncounterPayload);
            return;
          case 'END_BATTLE':
            handleEndBattle(dispatch);
            return;
          case 'CAST_SPELL':
            handleCastSpell(dispatch, action.payload as { characterId: string; spellLevel: number });
            break;
          case 'USE_LIMITED_ABILITY':
            handleUseLimitedAbility(dispatch, action.payload as { characterId: string; abilityId: string });
            break;
          case 'TOGGLE_PREPARED_SPELL':
            handleTogglePreparedSpell(dispatch, action.payload as { characterId: string; spellId: string; });
            break;
          case 'LONG_REST':
            await handleLongRest({ gameState, dispatch, addMessage, addGeminiLog });
            break;
          case 'SHORT_REST':
            handleShortRest({ dispatch, addMessage });
            break;
          case 'wait':
            if (action.payload?.seconds && action.payload.seconds > 0) {
              const durationString = formatDuration(action.payload.seconds);
              addMessage(`You wait for ${durationString}. Time passes.`, 'system');
              dispatch({ type: 'ADVANCE_TIME', payload: { seconds: action.payload.seconds } });
            }
            break;
          case 'save_game':
            await handleSaveGame({ gameState, dispatch, addMessage });
            return;
          case 'go_to_main_menu':
            await handleGoToMainMenu({ gameState, dispatch, addMessage });
            return;
          case 'toggle_map':
            handleToggleMap(dispatch);
            return;
          case 'toggle_submap_visibility':
            handleToggleSubmap(dispatch);
            return;
          case 'TOGGLE_DISCOVERY_LOG':
            handleToggleDiscoveryLog(dispatch);
            return;
          case 'TOGGLE_LOGBOOK':
            handleToggleLogbook(dispatch);
            return;
          case 'TOGGLE_GLOSSARY_VISIBILITY':
            handleToggleGlossary(dispatch, action.payload?.initialTermId);
            return;
          case 'toggle_dev_menu':
            handleToggleDevMenu(dispatch);
            return;
          case 'toggle_party_editor':
            handleTogglePartyEditor(dispatch);
            return;
          case 'toggle_party_overlay':
            handleTogglePartyOverlay(dispatch);
            return;
          case 'TOGGLE_NPC_TEST_MODAL':
            handleToggleNpcTestModal(dispatch);
            return;
          case 'ADD_MET_NPC':
            if (action.payload?.npcId) {
              dispatch({ type: 'ADD_MET_NPC', payload: { npcId: action.payload.npcId } });
            }
            break;

          // --- MERCHANT ACTIONS ---
          case 'OPEN_MERCHANT':
            dispatch({ type: 'OPEN_MERCHANT', payload: action.payload as { merchantName: string; inventory: Item[] } });
            return;
          case 'CLOSE_MERCHANT':
            dispatch({ type: 'CLOSE_MERCHANT' });
            return;
          case 'BUY_ITEM':
            dispatch({ type: 'BUY_ITEM', payload: action.payload as { item: Item; cost: number } });
            return;
          case 'SELL_ITEM':
            dispatch({ type: 'SELL_ITEM', payload: action.payload as { itemId: string; value: number } });
            return;

          // --- NEW DYNAMIC ACTIONS ---
          case 'OPEN_DYNAMIC_MERCHANT':
            await handleOpenDynamicMerchant({ action, gameState, dispatch, addMessage, addGeminiLog });
            break;
          case 'HARVEST_RESOURCE':
            await handleHarvestResource({ action, gameState, dispatch, addMessage, addGeminiLog });
            break;

          case 'TOGGLE_GAME_GUIDE':
            handleToggleGameGuide(dispatch);
            return;
          case 'TOGGLE_QUEST_LOG':
            handleToggleQuestLog(dispatch);
            return;


          case 'custom':
            if (action.payload?.villageContext) {
              // Typed context ensures we respect the generator's integration
              // cues (culture, biome, etc.) when crafting follow-up prompts or
              // messages. The Gemini log keeps visibility into what flavor text
              // was supplied for downstream AI calls.
              const villageContext = action.payload.villageContext as VillageActionContext;
              const detailText = villageContext.description || `You take in the details of the ${villageContext.buildingType ?? 'building'}.`;
              addMessage(detailText, 'system');
              if (villageContext.integrationPrompt) {
                addGeminiLog('villageContext', villageContext.integrationPrompt, detailText);
              }
              break;
            }
            if (action.label === 'Exit Village') {
              dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.PLAYING });
              addMessage('You leave the village and return to your journey.', 'system');
            } else if (action.label === 'Visit General Store') {
              // LEGACY FALLBACK - Should be replaced by dynamic call in VillageScene
              const inventory: Item[] = [ITEMS['healing_potion'], ITEMS['rope_item'], ITEMS['torch_item']].filter(Boolean);
              dispatch({ type: 'OPEN_MERCHANT', payload: { merchantName: "General Store (Legacy)", inventory } });
              addMessage('You enter the General Store.', 'system');
            } else if (action.label === 'Visit Blacksmith') {
              // LEGACY FALLBACK
              const inventory: Item[] = [WEAPONS_DATA['dagger'], ITEMS['shield_std']].filter(Boolean);
              dispatch({ type: 'OPEN_MERCHANT', payload: { merchantName: "The Anvil (Legacy)", inventory } });
              addMessage('You step into the sweltering heat of the Blacksmith.', 'system');
            } else if (action.label?.includes('Visit') || action.label?.includes('Examine') || action.label?.includes('Browse') || action.label?.includes('Speak')) {
              // ... flavor text logic ...
              addMessage(`You interact with: ${action.label}`, 'system');
            } else {
              addMessage(`Custom action: ${action.label}`, 'system');
            }
            break;
          default:
            addMessage(`Action type ${(action as any).type} not recognized.`, 'system');
            dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
            dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
        }
      } catch (err: any) {
        addMessage(`Error processing action: ${err.message}`, 'system');
        dispatch({ type: 'SET_ERROR', payload: err.message });
        dispatch({ type: 'SET_GEMINI_ACTIONS', payload: null });
        dispatch({ type: 'RESET_NPC_INTERACTION_CONTEXT' });
      } finally {
        if (!isUiToggle && action.type !== 'save_game' && action.type !== 'GENERATE_ENCOUNTER' && !action.type.includes('_MERCHANT') && !action.type.includes('_ITEM')) {
          dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
        }
      }
    },
    [
      gameState, dispatch, addMessage, playPcmAudio, getCurrentLocation, getCurrentNPCs, getTileTooltipText, addGeminiLog, logDiscovery
    ],
  );

  return { processAction };
}
