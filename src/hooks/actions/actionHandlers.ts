/**
 * @file src/hooks/actions/actionHandlers.ts
 * Central registry builder for action handlers.
 *
 * Architectural note:
 * - This module is intentionally stateless; dependencies are injected from
 *   src/hooks/useGameActions.ts so we do not import hooks or global state here.
 * - Domain-specific handler implementations live in src/hooks/actions/handle*.ts.
 * - Dispatch types come from src/state/actionTypes, and core data shapes from src/types.
 */
import type { Dispatch } from 'react';
import type {
  Action,
  EquipItemPayload,
  UnequipItemPayload,
  DropItemPayload,
  UseItemPayload,
  ShowEncounterModalPayload,
  StartBattleMapEncounterPayload,
  GameState,
  PlayerCharacter,
  Item,
  VillageActionContext,
} from '../../types';
import { GamePhase } from '../../types';
import type { AppAction } from '../../state/actionTypes';
import { ITEMS, WEAPONS_DATA } from '../../constants';
import { formatDuration } from '../../utils/timeUtils';
import type {
  AddGeminiLogFn,
  AddMessageFn,
  GetCurrentLocationFn,
  GetCurrentNPCsFn,
  GetTileTooltipTextFn,
  LogDiscoveryFn,
  PlayPcmAudioFn,
} from './actionHandlerTypes';

// Movement and travel handlers are implemented in src/hooks/actions/handleMovement.ts.
import { handleMovement, handleQuickTravel, handleApproachSettlement, handleObserveSettlement } from './handleMovement';
// Observation handlers are implemented in src/hooks/actions/handleObservation.ts.
import { handleLookAround, handleInspectSubmapTile, handleAnalyzeSituation } from './handleObservation';
// NPC interaction handlers are implemented in src/hooks/actions/handleNpcInteraction.ts.
import { handleTalk } from './handleNpcInteraction';
// Item interaction handlers are implemented in src/hooks/actions/handleItemInteraction.ts.
import { handleTakeItem, handleEquipItem, handleUnequipItem, handleUseItem, handleDropItem, handleHarvestResource } from './handleItemInteraction';
// Oracle/Gemini handlers are implemented in src/hooks/actions/handleOracle.ts and handleGeminiCustom.ts.
import { handleOracle } from './handleOracle';
import { handleGeminiCustom } from './handleGeminiCustom';
// Encounter handlers are implemented in src/hooks/actions/handleEncounter.ts.
import { handleGenerateEncounter, handleShowEncounterModal, handleHideEncounterModal, handleStartBattleMapEncounter, handleEndBattle } from './handleEncounter';
// Resource and spell handlers are implemented in src/hooks/actions/handleResourceActions.ts.
import { handleCastSpell, handleUseLimitedAbility, handleTogglePreparedSpell, handleLongRest, handleShortRest } from './handleResourceActions';
// Merchant handlers are implemented in src/hooks/actions/handleMerchantInteraction.ts.
import { handleOpenDynamicMerchant } from './handleMerchantInteraction';
// System/UI handlers are implemented in src/hooks/actions/handleSystemAndUi.ts.
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
  handleToggleQuestLog,
} from './handleSystemAndUi';

// Shared handler type: a pure function of action + injected context.
export type ActionHandler = (action: Action) => Promise<void> | void;

// Context is injected by useGameActions to keep this module decoupled from hooks.
export interface ActionHandlerContext {
  gameState: GameState;
  dispatch: Dispatch<AppAction>;
  addMessage: AddMessageFn;
  playPcmAudio: PlayPcmAudioFn;
  getCurrentLocation: GetCurrentLocationFn;
  getCurrentNPCs: GetCurrentNPCsFn;
  getTileTooltipText: GetTileTooltipTextFn;
  addGeminiLog: AddGeminiLogFn;
  logDiscovery: LogDiscoveryFn;
  playerCharacter: PlayerCharacter | undefined;
  playerContext: string;
  generalActionContext: string;
}

// Builds a handler registry so useGameActions can route by action.type.
export function buildActionHandlers({
  gameState,
  dispatch,
  addMessage,
  playPcmAudio,
  getCurrentLocation,
  getCurrentNPCs,
  getTileTooltipText,
  addGeminiLog,
  logDiscovery,
  playerCharacter,
  playerContext,
  generalActionContext,
}: ActionHandlerContext): Record<string, ActionHandler> {
  // TODO: Type this map against Action['type'] with an exhaustive check to catch missing/renamed actions; see docs/QOL_TODO.md (if this registry moves, update that entry).
  const handlers: Record<string, ActionHandler> = {
    // Movement and settlement flow (handleMovement.ts).
    move: async (action) => {
      if (!playerCharacter) return;
      await handleMovement({ action, gameState, dispatch, addMessage, addGeminiLog, logDiscovery, getTileTooltipText, playerContext, playerCharacter });
    },
    QUICK_TRAVEL: async (action) => {
      await handleQuickTravel({ action, gameState, dispatch, addMessage });
    },
    ENTER_VILLAGE: (action) => {
      // Store the entry direction for spawn positioning in TownCanvas
      const entryDirection = action.payload?.entryDirection as 'north' | 'east' | 'south' | 'west' | undefined;
      if (entryDirection) {
        dispatch({ type: 'SET_TOWN_ENTRY_DIRECTION', payload: { direction: entryDirection } });
      }
      dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.VILLAGE_VIEW });
    },
    APPROACH_VILLAGE: async (action) => {
      await handleApproachSettlement({ gameState, dispatch, addMessage, action });
    },
    APPROACH_TOWN: async (action) => {
      await handleApproachSettlement({ gameState, dispatch, addMessage, action });
    },
    OBSERVE_VILLAGE: async (action) => {
      await handleObserveSettlement({ gameState, dispatch, addMessage, addGeminiLog, action });
    },
    OBSERVE_TOWN: async (action) => {
      await handleObserveSettlement({ gameState, dispatch, addMessage, addGeminiLog, action });
    },

    // Observation and situational analysis (handleObservation.ts).
    // TODO(lint-intent): 'action' is an unused parameter, which suggests a planned input for this flow.
    // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
    // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
    look_around: async (_action) => {
      await handleLookAround({ gameState, dispatch, addMessage, addGeminiLog, generalActionContext, getTileTooltipText });
    },
    // TODO(lint-intent): 'action' is an unused parameter, which suggests a planned input for this flow.
    // TODO(lint-intent): If the contract should consume it, thread it into the decision/transform path or document why it exists.
    // TODO(lint-intent): Otherwise rename it with a leading underscore or remove it if the signature can change.
    ANALYZE_SITUATION: async (_action) => {
      await handleAnalyzeSituation({ gameState, dispatch, addMessage, addGeminiLog, generalActionContext });
    },
    inspect_submap_tile: async (action) => {
      await handleInspectSubmapTile({ action, gameState, dispatch, addMessage, addGeminiLog, generalActionContext });
    },

    // NPC dialogue and narrative AI (handleNpcInteraction.ts, handleOracle.ts, handleGeminiCustom.ts).
    talk: async (action) => {
      await handleTalk({ action, gameState, dispatch, addMessage, addGeminiLog, playPcmAudio, playerContext, generalActionContext });
    },
    ask_oracle: async (action) => {
      await handleOracle({ action, gameState, dispatch, addMessage, addGeminiLog, playPcmAudio, generalActionContext });
    },
    gemini_custom_action: async (action) => {
      await handleGeminiCustom({ action, gameState, dispatch, addMessage, addGeminiLog, generalActionContext, getCurrentLocation, getCurrentNPCs });
    },

    // Item interactions and inventory changes (handleItemInteraction.ts).
    take_item: async (action) => {
      await handleTakeItem({ action, gameState, dispatch, addMessage });
    },
    EQUIP_ITEM: (action) => {
      handleEquipItem(dispatch, action.payload as EquipItemPayload);
    },
    UNEQUIP_ITEM: (action) => {
      handleUnequipItem(dispatch, action.payload as UnequipItemPayload);
    },
    use_item: (action) => {
      handleUseItem(dispatch, action.payload as UseItemPayload);
    },
    DROP_ITEM: (action) => {
      handleDropItem(dispatch, action.payload as DropItemPayload);
    },
    AUTO_EQUIP: (action) => {
      dispatch({ type: 'AUTO_EQUIP', payload: action.payload as { characterId: string } });
    },
    HARVEST_RESOURCE: async (action) => {
      await handleHarvestResource({ action, gameState, dispatch, addMessage, addGeminiLog });
    },

    // Encounter and combat flow (handleEncounter.ts).
    GENERATE_ENCOUNTER: async () => {
      await handleGenerateEncounter({ gameState, dispatch });
    },
    SHOW_ENCOUNTER_MODAL: (action) => {
      handleShowEncounterModal(dispatch, action.payload?.encounterData as ShowEncounterModalPayload);
    },
    HIDE_ENCOUNTER_MODAL: () => {
      handleHideEncounterModal(dispatch);
    },
    START_BATTLE_MAP_ENCOUNTER: (action) => {
      handleStartBattleMapEncounter(dispatch, action.payload?.startBattleMapEncounterData as StartBattleMapEncounterPayload);
    },
    END_BATTLE: () => {
      handleEndBattle(dispatch);
    },

    // Spellcasting and resource management (handleResourceActions.ts).
    CAST_SPELL: (action) => {
      handleCastSpell(dispatch, action.payload as { characterId: string; spellLevel: number });
    },
    USE_LIMITED_ABILITY: (action) => {
      handleUseLimitedAbility(dispatch, action.payload as { characterId: string; abilityId: string });
    },
    TOGGLE_PREPARED_SPELL: (action) => {
      handleTogglePreparedSpell(dispatch, action.payload as { characterId: string; spellId: string; });
    },
    LONG_REST: async () => {
      await handleLongRest({ gameState, dispatch, addMessage, addGeminiLog });
    },
    SHORT_REST: () => {
      handleShortRest({ dispatch, addMessage });
  },
  wait: (action) => {
      const seconds = Number((action.payload as { seconds?: number } | undefined)?.seconds ?? 0);
      if (seconds > 0) {
        const durationString = formatDuration(seconds);
        addMessage(`You wait for ${durationString}. Time passes.`, 'system');
        dispatch({ type: 'ADVANCE_TIME', payload: { seconds } });
      }
  },

    // System/UI actions (handleSystemAndUi.ts) and persistence (handleSaveGame/handleGoToMainMenu).
    save_game: async () => {
      await handleSaveGame({ gameState, dispatch, addMessage });
    },
    go_to_main_menu: async () => {
      await handleGoToMainMenu({ gameState, dispatch, addMessage });
    },
    toggle_map: () => {
      handleToggleMap(dispatch);
    },
    toggle_submap_visibility: () => {
      handleToggleSubmap(dispatch);
    },
    TOGGLE_DISCOVERY_LOG: () => {
      handleToggleDiscoveryLog(dispatch);
    },
    TOGGLE_LOGBOOK: () => {
      handleToggleLogbook(dispatch);
    },
    TOGGLE_GLOSSARY_VISIBILITY: (action) => {
      handleToggleGlossary(dispatch, action.payload?.initialTermId);
    },
    toggle_dev_menu: () => {
      handleToggleDevMenu(dispatch);
    },
    toggle_party_editor: () => {
      handleTogglePartyEditor(dispatch);
    },
    toggle_party_overlay: () => {
      handleTogglePartyOverlay(dispatch);
    },
    TOGGLE_NPC_TEST_MODAL: () => {
      handleToggleNpcTestModal(dispatch);
    },
    TOGGLE_GAME_GUIDE: () => {
      handleToggleGameGuide(dispatch);
    },
    TOGGLE_QUEST_LOG: () => {
      handleToggleQuestLog(dispatch);
    },
    SET_DEV_MODE_ENABLED: (action) => {
      dispatch({ type: 'SET_DEV_MODE_ENABLED', payload: action.payload?.enabled as boolean });
    },

    // Merchant actions are inline because they only dispatch local UI state updates.
    // TODO: Validate merchant payload shapes (item/cost/value) before dispatch to guard against malformed actions; see docs/QOL_TODO.md (update that entry if this block moves).
    OPEN_MERCHANT: (action) => {
      dispatch({ type: 'OPEN_MERCHANT', payload: action.payload as { merchantName: string; inventory: Item[] } });
    },
    CLOSE_MERCHANT: () => {
      dispatch({ type: 'CLOSE_MERCHANT' });
    },
    BUY_ITEM: (action) => {
      dispatch({ type: 'BUY_ITEM', payload: action.payload as { item: Item; cost: number } });
    },
    SELL_ITEM: (action) => {
      dispatch({ type: 'SELL_ITEM', payload: action.payload as { itemId: string; value: number } });
    },
    OPEN_DYNAMIC_MERCHANT: async (action) => {
      await handleOpenDynamicMerchant({ action, gameState, dispatch, addMessage, addGeminiLog, generalActionContext });
    },

    // Legacy custom actions remain inline because they depend on local constants.
    // TODO: Replace label-string branching with explicit action types/config data to decouple behavior from UI copy; see docs/QOL_TODO.md (update that entry if this block moves).
    custom: (action) => {
      if (action.payload?.villageContext) {
        // Keeps village narrative integration co-located with the data structure in src/types.
        const villageContext = action.payload.villageContext as VillageActionContext;
        const detailText = villageContext.description || `You take in the details of the ${villageContext.buildingType ?? 'building'}.`;
        addMessage(detailText, 'system');
        if (villageContext.integrationPrompt) {
          addGeminiLog('villageContext', villageContext.integrationPrompt, detailText);
        }
        return;
      }
      if (action.label === 'Exit Village') {
        dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.PLAYING });
        addMessage('You leave the village and return to your journey.', 'system');
      } else if (action.label === 'Visit General Store') {
        // Legacy fallback keeps the inventory data in src/constants.
        const inventory: Item[] = [ITEMS['healing_potion'], ITEMS['rope_item'], ITEMS['torch_item']].filter(Boolean);
        dispatch({ type: 'OPEN_MERCHANT', payload: { merchantName: "General Store (Legacy)", inventory } });
        addMessage('You enter the General Store.', 'system');
      } else if (action.label === 'Visit Blacksmith') {
        // Legacy fallback keeps the inventory data in src/constants.
        const inventory: Item[] = [WEAPONS_DATA['dagger'], ITEMS['shield_std']].filter(Boolean);
        dispatch({ type: 'OPEN_MERCHANT', payload: { merchantName: "The Anvil (Legacy)", inventory } });
        addMessage('You step into the sweltering heat of the Blacksmith.', 'system');
      } else if (action.label?.includes('Visit') || action.label?.includes('Examine') || action.label?.includes('Browse') || action.label?.includes('Speak')) {
        // Flavor-only custom actions stay here to avoid creating new handler files.
        addMessage(`You interact with: ${action.label}`, 'system');
      } else {
        addMessage(`Custom action: ${action.label}`, 'system');
      }
    },

    // Minimal inline dispatch so we do not add a tiny handler module just for this case.
    ADD_MET_NPC: (action) => {
      if (action.payload?.npcId) {
        dispatch({ type: 'ADD_MET_NPC', payload: { npcId: action.payload.npcId } });
      }
    },
  };

  return handlers;
}
