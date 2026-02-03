// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 31/01/2026, 18:01:52
 * Dependents: actionTypes.ts, state.ts, types/index.ts
 * Imports: 6 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { EquipmentSlotType, Item } from './items';
import { Monster, Location, VillageActionContext, DiscoveryResidue, GoalStatus, GossipUpdatePayload } from './world';
import { Quest } from './quests';
import { TempPartyMember, PlayerCharacter, HitPointDiceSpendMap } from './character';
import { Faction } from './factions';
import { DialogueSession } from './dialogue';

// -----------------------------------------------------------------------------
// Actions & payloads
// -----------------------------------------------------------------------------

export type ActionType =
  | 'move'
  | 'look_around'
  | 'talk'
  | 'take_item'
  | 'use_item'
  | 'custom'
  | 'ask_oracle'
  | 'toggle_map'
  | 'toggle_submap_visibility'
  | 'toggle_three_d'
  | 'gemini_custom_action'
  | 'save_game'
  | 'go_to_main_menu'
  | 'inspect_submap_tile'
  | 'toggle_dev_menu'
  | 'toggle_party_editor'
  | 'toggle_party_overlay'
  | 'toggle_gemini_log_viewer'
  | 'TOGGLE_NPC_TEST_MODAL'
  | 'UPDATE_INSPECTED_TILE_DESCRIPTION'
  | 'TOGGLE_DISCOVERY_LOG'
  | 'TOGGLE_GLOSSARY_VISIBILITY'
  | 'TOGGLE_LOGBOOK'
  | 'ADD_MET_NPC'
  | 'EQUIP_ITEM'
  | 'UNEQUIP_ITEM'
  | 'DROP_ITEM'
  | 'SET_LOADING'
  | 'GENERATE_ENCOUNTER'
  | 'SHOW_ENCOUNTER_MODAL'
  | 'HIDE_ENCOUNTER_MODAL'
  | 'START_BATTLE_MAP_ENCOUNTER'
  | 'END_BATTLE'
  | 'CAST_SPELL'
  | 'USE_LIMITED_ABILITY'
  | 'LONG_REST'
  | 'SHORT_REST'
  | 'TOGGLE_PREPARED_SPELL'
  | 'UPDATE_NPC_GOAL_STATUS'
  | 'PROCESS_GOSSIP_UPDATES'
  | 'ADD_LOCATION_RESIDUE'
  | 'REMOVE_LOCATION_RESIDUE'
  | 'QUICK_TRAVEL'
  | 'ENTER_VILLAGE'
  | 'APPROACH_VILLAGE'
  | 'OBSERVE_VILLAGE'
  | 'APPROACH_TOWN'
  | 'OBSERVE_TOWN'
  | 'OPEN_MERCHANT'
  | 'CLOSE_MERCHANT'
  | 'BUY_ITEM'
  | 'SELL_ITEM'
  | 'OPEN_DYNAMIC_MERCHANT' // New
  | 'OPEN_TEMPLE' // New
  | 'CLOSE_TEMPLE' // New
  | 'USE_TEMPLE_SERVICE' // New
  | 'HARVEST_RESOURCE' // New
  | 'BARTER_ITEMS' // New
  | 'HAGGLE_ITEM' // New
  | 'ANALYZE_SITUATION'
  | 'wait'
  | 'TOGGLE_GAME_GUIDE'
  | 'UPDATE_CHARACTER_CHOICE'
  | 'ACCEPT_QUEST'
  | 'UPDATE_QUEST_OBJECTIVE'
  | 'COMPLETE_QUEST'
  | 'TOGGLE_QUEST_LOG'
  | 'PRAY'
  | 'AUTO_EQUIP'
  | 'TOGGLE_THIEVES_GUILD'
  | 'REGISTER_DYNAMIC_ENTITY'
  | 'START_DIALOGUE_SESSION'
  | 'UPDATE_DIALOGUE_SESSION'
  | 'END_DIALOGUE_SESSION'
  | 'SET_DEV_MODE_ENABLED'
  // Village-specific actions (migrated from label-based custom actions)
  | 'EXIT_VILLAGE'
  | 'VISIT_GENERAL_STORE'
  | 'VISIT_BLACKSMITH';

/**
 * Metadata for actions to control UI behavior like loading spinners.
 */
export interface ActionMetadata {
  /** If true, this action is a UI toggle and should NOT trigger the global loading spinner. */
  isUiToggle?: boolean;
  /** If true, the handler for this action manages its own loading state. */
  managesLoading?: boolean;
}

/**
 * Registry of action behavior metadata.
 */
export const ACTION_METADATA: Partial<Record<ActionType, ActionMetadata>> = {
  toggle_map: { isUiToggle: true },
  toggle_submap_visibility: { isUiToggle: true },
  toggle_three_d: { isUiToggle: true },
  toggle_dev_menu: { isUiToggle: true },
  toggle_gemini_log_viewer: { isUiToggle: true },
  TOGGLE_DISCOVERY_LOG: { isUiToggle: true },
  TOGGLE_GLOSSARY_VISIBILITY: { isUiToggle: true },
  HIDE_ENCOUNTER_MODAL: { isUiToggle: true },
  SHOW_ENCOUNTER_MODAL: { isUiToggle: true },
  toggle_party_editor: { isUiToggle: true },
  toggle_party_overlay: { isUiToggle: true },
  TOGGLE_NPC_TEST_MODAL: { isUiToggle: true },
  TOGGLE_LOGBOOK: { isUiToggle: true },
  CLOSE_MERCHANT: { isUiToggle: true },
  BUY_ITEM: { isUiToggle: true },
  SELL_ITEM: { isUiToggle: true },
  TOGGLE_GAME_GUIDE: { isUiToggle: true },
  TOGGLE_QUEST_LOG: { isUiToggle: true },
  SET_DEV_MODE_ENABLED: { isUiToggle: true },
  UPDATE_QUEST_OBJECTIVE: { isUiToggle: true },
  UPDATE_NPC_GOAL_STATUS: { isUiToggle: true },
  UPDATE_CHARACTER_CHOICE: { isUiToggle: true },
  // Actions that manage their own loading state
  save_game: { managesLoading: true },
  GENERATE_ENCOUNTER: { managesLoading: true },
  OPEN_DYNAMIC_MERCHANT: { managesLoading: true },
  HARVEST_RESOURCE: { managesLoading: true },
  BARTER_ITEMS: { managesLoading: true },
  HAGGLE_ITEM: { managesLoading: true },
};

export interface MerchantActionPayload {
  merchantId?: string; // Optional for some local contexts
  interactorId?: string; // Which party member is talking
  strategy?: 'persuade' | 'intimidate' | 'insight' | 'appraise' | 'barter' | 'deceive' | 'lore_check';
  priceMultiplier?: number; // Applied to item cost after successful haggle

  transaction?: {
    buy?: { item: Item; cost: number; quantity?: number };
    sell?: { itemId: string; value: number; quantity?: number };
    barter?: { offeredItemIds: string[]; requestedItemIds: string[]; goldOffset: number };
  };
}

export interface InspectSubmapTilePayload {
  tileX: number;
  tileY: number;
  effectiveTerrainType: string;
  worldBiomeId: string;
  parentWorldMapCoords: { x: number; y: number };
  activeFeatureConfig?: { id: string; name?: string; icon: string; generatesEffectiveTerrainType?: string };
}

export interface UpdateInspectedTileDescriptionPayload {
  tileKey: string;
  description: string;
}

export interface EquipItemPayload {
  itemId: string;
  characterId: string;
}
export interface UnequipItemPayload {
  slot: EquipmentSlotType;
  characterId: string;
}
export interface UseItemPayload {
  itemId: string;
  characterId: string;
}
export interface DropItemPayload {
  itemId: string;
  characterId: string;
}

export interface AddLocationResiduePayload {
  locationId: string;
  residue: DiscoveryResidue;
}

export interface RemoveLocationResiduePayload {
  locationId: string;
}

export interface SetLoadingPayload {
  isLoading: boolean;
  message?: string | null;
}

export interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}

export interface ShowEncounterModalPayload {
  encounter?: Monster[];
  sources?: GroundingChunk[];
  error?: string;
  partyUsed?: TempPartyMember[];
}

export interface StartBattleMapEncounterPayload {
  monsters: Monster[];
}

export interface QuickTravelPayload {
  destination: { x: number; y: number };
  durationSeconds: number;
}

export interface StartGameSuccessPayload {
  character: PlayerCharacter;
  mapData: import('./world').MapData;
  dynamicLocationItemIds: Record<string, string[]>;
  initialLocationDescription: string;
  initialSubMapCoordinates: { x: number; y: number };
  initialActiveDynamicNpcIds: string[] | null;
  startingInventory: Item[];
}

export type Action =
  | { type: 'move'; payload: { query?: string; geminiPrompt?: string }; label?: string }
  | { type: 'look_around'; payload?: { query?: string }; label?: string }
  | { type: 'talk'; payload: { targetNpcId?: string; query?: string; isEgregious?: boolean }; label?: string }
  | { type: 'take_item'; payload: { itemId: string }; label?: string }
  | { type: 'use_item'; payload: UseItemPayload; label?: string }
  | { type: 'custom'; payload?: { villageContext?: VillageActionContext }; label?: string }
  | { type: 'ask_oracle'; payload: { query: string }; label?: string }
  | { type: 'toggle_map'; payload?: never; label?: string }
  | { type: 'toggle_submap_visibility'; payload?: never; label?: string }
  | { type: 'toggle_three_d'; payload?: never; label?: string }
  | { type: 'gemini_custom_action'; payload: { query: string }; label?: string }
  | { type: 'save_game'; payload?: never; label?: string }
  | { type: 'go_to_main_menu'; payload?: never; label?: string }
  | { type: 'inspect_submap_tile'; payload: { inspectTileDetails: InspectSubmapTilePayload }; label?: string }
  | { type: 'toggle_dev_menu'; payload?: never; label?: string }
  | { type: 'toggle_party_editor'; payload?: never; label?: string }
  | { type: 'toggle_party_overlay'; payload?: never; label?: string }
  | { type: 'toggle_gemini_log_viewer'; payload?: never; label?: string }
  | { type: 'TOGGLE_NPC_TEST_MODAL'; payload?: never; label?: string }
  | { type: 'UPDATE_INSPECTED_TILE_DESCRIPTION'; payload: UpdateInspectedTileDescriptionPayload; label?: string }
  | { type: 'TOGGLE_DISCOVERY_LOG'; payload?: never; label?: string }
  | { type: 'TOGGLE_GLOSSARY_VISIBILITY'; payload?: { initialTermId?: string }; label?: string }
  | { type: 'TOGGLE_LOGBOOK'; payload?: never; label?: string }
  | { type: 'ADD_MET_NPC'; payload: { npcId: string }; label?: string }
  | { type: 'EQUIP_ITEM'; payload: EquipItemPayload; label?: string }
  | { type: 'UNEQUIP_ITEM'; payload: UnequipItemPayload; label?: string }
  | { type: 'DROP_ITEM'; payload: DropItemPayload; label?: string }
  | { type: 'SET_LOADING'; payload: SetLoadingPayload; label?: string }
  | { type: 'GENERATE_ENCOUNTER'; payload?: never; label?: string }
  | { type: 'SHOW_ENCOUNTER_MODAL'; payload?: { encounterData: ShowEncounterModalPayload }; label?: string }
  | { type: 'HIDE_ENCOUNTER_MODAL'; payload?: never; label?: string }
  | { type: 'START_BATTLE_MAP_ENCOUNTER'; payload?: { startBattleMapEncounterData: StartBattleMapEncounterPayload }; label?: string }
  | { type: 'END_BATTLE'; payload?: never; label?: string }
  | { type: 'CAST_SPELL'; payload: { characterId: string; spellLevel: number }; label?: string }
  | { type: 'USE_LIMITED_ABILITY'; payload: { characterId: string; abilityId: string }; label?: string }
  | { type: 'LONG_REST'; payload?: never; label?: string }
  | { type: 'SHORT_REST'; payload?: { hitPointDiceSpend?: HitPointDiceSpendMap }; label?: string }
  | { type: 'TOGGLE_PREPARED_SPELL'; payload: { characterId: string; spellId: string }; label?: string }
  | { type: 'UPDATE_NPC_GOAL_STATUS'; payload: { npcId: string; goalId: string; status: GoalStatus }; label?: string }
  | { type: 'PROCESS_GOSSIP_UPDATES'; payload: GossipUpdatePayload; label?: string }
  | { type: 'ADD_LOCATION_RESIDUE'; payload: AddLocationResiduePayload; label?: string }
  | { type: 'REMOVE_LOCATION_RESIDUE'; payload: RemoveLocationResiduePayload; label?: string }
  | { type: 'QUICK_TRAVEL'; payload: { quickTravel: QuickTravelPayload }; label?: string }
  | { type: 'ENTER_VILLAGE'; payload?: { entryDirection?: string }; label?: string }
  | { type: 'APPROACH_VILLAGE'; payload?: never; label?: string }
  | { type: 'OBSERVE_VILLAGE'; payload?: never; label?: string }
  | { type: 'APPROACH_TOWN'; payload?: never; label?: string }
  | { type: 'OBSERVE_TOWN'; payload?: never; label?: string }
  | { type: 'OPEN_MERCHANT'; payload: { merchantName: string; inventory: Item[]; economy?: import('./economy').EconomyState }; label?: string }
  | { type: 'CLOSE_MERCHANT'; payload?: unknown; label?: string }
  | { type: 'BUY_ITEM'; payload: MerchantActionPayload; label?: string }
  | { type: 'SELL_ITEM'; payload: MerchantActionPayload; label?: string }
  | { type: 'BARTER_ITEMS'; payload: MerchantActionPayload; label?: string }
  | { type: 'HAGGLE_ITEM'; payload: MerchantActionPayload; label?: string }
  | { type: 'OPEN_DYNAMIC_MERCHANT'; payload: { merchantType: string; villageContext?: VillageActionContext; buildingId?: string; seedKey?: string }; label?: string }
  | { type: 'OPEN_TEMPLE'; payload: { villageContext: VillageActionContext }; label?: string }
  | { type: 'CLOSE_TEMPLE'; payload?: never; label?: string }
  | { type: 'USE_TEMPLE_SERVICE'; payload: { templeId: string; deityId: string; cost: number; effect: unknown }; label?: string }
  | { type: 'HARVEST_RESOURCE'; payload: { harvestContext?: string; skillCheck?: { skill: string; dc: number } }; label?: string }
  | { type: 'ANALYZE_SITUATION'; payload?: never; label?: string }
  | { type: 'wait'; payload?: { seconds?: number }; label?: string }
  | { type: 'TOGGLE_GAME_GUIDE'; payload?: never; label?: string }
  | { type: 'UPDATE_CHARACTER_CHOICE'; payload: { characterId: string; choiceType: string; choiceId: string; secondaryValue?: unknown }; label?: string }
  | { type: 'ACCEPT_QUEST'; payload: Quest; label?: string }
  | { type: 'UPDATE_QUEST_OBJECTIVE'; payload: { questId: string; objectiveId: string; isCompleted: boolean }; label?: string }
  | { type: 'COMPLETE_QUEST'; payload: { questId: string }; label?: string }
  | { type: 'TOGGLE_QUEST_LOG'; payload?: never; label?: string }
  | { type: 'PRAY'; payload: { deityId: string; offering?: number }; label?: string }
  | { type: 'AUTO_EQUIP'; payload: { characterId: string }; label?: string }
  | { type: 'TOGGLE_THIEVES_GUILD'; payload?: never; label?: string }
  | { type: 'REGISTER_DYNAMIC_ENTITY'; payload: { entityType: 'location' | 'faction'; entity: Location | Faction }; label?: string }
  | { type: 'START_DIALOGUE_SESSION'; payload: { npcId: string }; label?: string }
  | { type: 'UPDATE_DIALOGUE_SESSION'; payload: { session: DialogueSession }; label?: string }
  | { type: 'END_DIALOGUE_SESSION'; payload?: never; label?: string }
  | { type: 'SET_DEV_MODE_ENABLED'; payload: { enabled: boolean }; label?: string }
  | { type: 'EXIT_VILLAGE'; payload?: never; label?: string }
  | { type: 'VISIT_GENERAL_STORE'; payload?: never; label?: string }
  | { type: 'VISIT_BLACKSMITH'; payload?: never; label?: string };
