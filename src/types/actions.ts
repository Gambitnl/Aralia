import { EquipmentSlotType, Item } from './items';
import { Monster, Location, VillageActionContext, DiscoveryResidue } from './world';
import { Quest } from './quests';
import { TempPartyMember, PlayerCharacter } from './character';
import { Faction } from './factions';

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
  | 'SET_DEV_MODE_ENABLED';

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

export interface Action {
  type: ActionType;
  label: string;
  targetId?: string;
  payload?: {
    query?: string;
    geminiPrompt?: string;
    check?: string;
    targetNpcId?: string;
    isEgregious?: boolean;
    inspectTileDetails?: InspectSubmapTilePayload;
    itemId?: string;
    slot?: EquipmentSlotType;
    initialTermId?: string;
    characterId?: string;
    spellId?: string;
    spellLevel?: number;
    abilityId?: string;
    encounterData?: ShowEncounterModalPayload;
    startBattleMapEncounterData?: StartBattleMapEncounterPayload;
    npcId?: string;
    residue?: AddLocationResiduePayload;
    locationId?: string;
    quickTravel?: QuickTravelPayload;
    merchantId?: string;
    merchantInventory?: Item[];
    cost?: number;
    value?: number;
    item?: Item;
    // New payloads for dynamic generation.
    merchantType?: string;
    villageContext?: VillageActionContext;
    skillCheck?: { skill: string; dc: number };
    harvestContext?: string;

    // For missing choice updates
    choiceType?: string;
    choiceId?: string;

    // For Quests
    quest?: Quest;
    objectiveId?: string;
    isCompleted?: boolean;
    questId?: string;

    // For Temple
    templeId?: string;
    serviceId?: string;
    effect?: string;

    // Linker: Dynamic Entity
    entityType?: 'location' | 'faction';
    entity?: Location | Faction;
    // TODO(lint-intent): The any on this value hides the intended shape of this data.
    // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
    // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
    [key: string]: unknown;
  };
}
