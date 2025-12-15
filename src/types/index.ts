
/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/types/index.ts
 * This file contains all the core TypeScript type definitions and interfaces
 * used throughout the Aralia RPG application.
 */
// TODO: Implement Zod schemas for all game data structures (spells, NPCs, items) to ensure data integrity and provide better error messages
import React from 'react';
import { CombatCharacter, CharacterStats, Position, CombatState } from './combat'; // Adjusted import path for sibling file
import type { VillageTileType } from '../services/villageGenerator';

export type { CombatCharacter, CharacterStats, Position, CombatState };

export * from './core';
export * from './items';
export * from './character';
export * from './spells';

export enum GamePhase {
  MAIN_MENU,
  CHARACTER_CREATION,
  PLAYING,
  GAME_OVER,
  BATTLE_MAP_DEMO,
  LOAD_TRANSITION,
  VILLAGE_VIEW,
  COMBAT, // New phase for active combat encounters
}

export interface LocationDynamicNpcConfig {
  possibleNpcIds: string[];
  maxSpawnCount: number;
  baseSpawnChance: number;
}

export interface Location {
  id: string;
  name: string;
  baseDescription: string;
  exits: { [direction: string]: string };
  itemIds?: string[];
  npcIds?: string[];
  dynamicNpcConfig?: LocationDynamicNpcConfig;
  mapCoordinates: { x: number; y: number };
  biomeId: string;
  gossipLinks?: string[];
}

export interface TTSVoiceOption {
  name: string;
  characteristic: string;
}

export enum SuspicionLevel {
  Unaware,
  Suspicious,
  Alert,
}

export enum GoalStatus {
  Unknown = 'Unknown',
  Active = 'Active',
  Completed = 'Completed',
  Failed = 'Failed',
}

export interface Goal {
  id: string;
  description: string;
  status: GoalStatus;
}

export interface GoalUpdatePayload {
  npcId: string;
  goalId: string;
  newStatus: GoalStatus;
}

export interface KnownFact {
  id: string;
  text: string;
  source: 'direct' | 'gossip';
  sourceNpcId?: string;
  isPublic: boolean;
  timestamp: number;
  strength: number;
  lifespan: number;
  sourceDiscoveryId?: string;
}

export interface DiscoveryResidue {
  text: string;
  discoveryDc: number;
  discovererNpcId: string;
}

export interface NpcMemory {
  disposition: number;
  knownFacts: KnownFact[];
  suspicion: SuspicionLevel;
  goals: Goal[];
  lastInteractionTimestamp?: number;
}

export interface GossipUpdatePayload {
  [npcId: string]: {
    newFacts: KnownFact[];
    dispositionNudge: number;
  };
}

export interface NPC {
  id: string;
  name: string;
  baseDescription: string;
  initialPersonalityPrompt: string;
  role: 'merchant' | 'quest_giver' | 'guard' | 'civilian' | 'unique';
  faction?: string;
  dialoguePromptSeed?: string;
  voice?: TTSVoiceOption;
  goals?: Goal[];
}

export interface GameMessage {
  id: number;
  text: string;
  sender: 'system' | 'player' | 'npc';
  timestamp: Date;
}

export interface Biome {
  id: string;
  name: string;
  color: string;
  icon?: string;
  description: string;
  passable: boolean;
  impassableReason?: string;
}

export interface MapTile {
  x: number;
  y: number;
  biomeId: string;
  locationId?: string;
  discovered: boolean;
  isPlayerCurrent: boolean;
}

export interface MapData {
  gridSize: { rows: number; cols: number };
  tiles: MapTile[][];
}

export enum QuestStatus {
  Active = 'Active',
  Completed = 'Completed',
  Failed = 'Failed'
}

export interface QuestObjective {
  id: string;
  description: string;
  isCompleted: boolean;
}

export interface QuestReward {
  gold?: number;
  xp?: number;
  items?: string[]; // Item IDs
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  giverId: string; // NPC ID
  status: QuestStatus;
  objectives: QuestObjective[];
  rewards?: QuestReward;
  dateStarted: number;
  dateCompleted?: number;
}

export interface GeminiLogEntry {
  timestamp: Date;
  functionName: string;
  prompt: string;
  response: string;
}

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
  | 'HARVEST_RESOURCE' // New
  | 'ANALYZE_SITUATION'
  | 'wait'
  | 'TOGGLE_GAME_GUIDE'
  | 'UPDATE_CHARACTER_CHOICE'
  | 'ACCEPT_QUEST'
  | 'UPDATE_QUEST_OBJECTIVE'
  | 'COMPLETE_QUEST'
  | 'TOGGLE_QUEST_LOG';


export enum DiscoveryType {
  LOCATION_DISCOVERY = 'Location Discovery',
  NPC_INTERACTION = 'NPC Interaction',
  ITEM_ACQUISITION = 'Item Acquired',
  ITEM_USED = 'Item Used',
  ITEM_EQUIPPED = 'Item Equipped',
  ITEM_UNEQUIPPED = 'Item Unequipped',
  ITEM_DROPPED = 'Item Dropped',
  LORE_DISCOVERY = 'Lore Uncovered',
  QUEST_UPDATE = 'Quest Update',
  MISC_EVENT = 'Miscellaneous Event',
  ACTION_DISCOVERED = 'Past Action Discovered',
  HARVEST = 'Harvest', // New
}

export interface DiscoveryFlag {
  key: string;
  value: string | number | boolean;
  label?: string;
}

export interface DiscoverySource {
  type: 'LOCATION' | 'NPC' | 'ITEM' | 'SYSTEM' | 'PLAYER_ACTION';
  id?: string;
  name?: string;
}

export interface DiscoveryEntry {
  id: string;
  timestamp: number;
  gameTime: string;
  type: DiscoveryType;
  title: string;
  content: string;
  source: DiscoverySource;
  flags: DiscoveryFlag[];
  isRead: boolean;
  isQuestRelated?: boolean;
  questId?: string;
  questStatus?: string;
  worldMapCoordinates?: { x: number; y: number };
  associatedLocationId?: string;
}

export interface Monster {
  name: string;
  quantity: number;
  cr: string;
  description: string;
}

export interface MonsterData {
  id: string;
  name: string;
  baseStats: CharacterStats;
  maxHP: number;
  abilities: CombatCharacter['abilities'];
  tags: string[];
}

export interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}

export interface StartGameSuccessPayload {
  character: import('./character').PlayerCharacter; // Explicitly refer to character.ts
  mapData: MapData;
  dynamicLocationItemIds: Record<string, string[]>;
  initialLocationDescription: string;
  initialSubMapCoordinates: { x: number; y: number };
  initialActiveDynamicNpcIds: string[] | null;
  startingInventory: import('./items').Item[]; // Explicitly refer to items.ts
}

export interface EconomyState {
  marketFactors: {
    scarcity: string[]; // Item types or tags that are scarce (high demand)
    surplus: string[]; // Item types or tags that are abundant (low value)
  };
  buyMultiplier: number; // Base multiplier for buying
  sellMultiplier: number; // Base multiplier for selling
}

export interface GameState {
  phase: GamePhase;
  previousPhase?: GamePhase; // Track previous phase for back navigation
  party: import('./character').PlayerCharacter[]; // Explicitly refer to character.ts
  tempParty: import('./character').TempPartyMember[] | null; // Explicitly refer to character.ts
  inventory: import('./items').Item[]; // Explicitly refer to items.ts
  gold: number;
  currentLocationId: string;
  subMapCoordinates: { x: number; y: number } | null;
  messages: GameMessage[];
  isLoading: boolean;
  loadingMessage: string | null;
  isImageLoading: boolean;
  error: string | null;
  worldSeed: number;
  mapData: MapData | null;
  isMapVisible: boolean;
  isSubmapVisible: boolean;
  isPartyOverlayVisible: boolean;
  isNpcTestModalVisible: boolean;
  isLogbookVisible: boolean;
  isGameGuideVisible: boolean; // New state for chatbot
  dynamicLocationItemIds: Record<string, string[]>;
  currentLocationActiveDynamicNpcIds: string[] | null;
  geminiGeneratedActions: Action[] | null;
  characterSheetModal: {
    isOpen: boolean;
    character: import('./character').PlayerCharacter | null;
  };
  gameTime: Date;

  isDevMenuVisible: boolean;
  isPartyEditorVisible: boolean;
  isGeminiLogViewerVisible: boolean;
  geminiInteractionLog: GeminiLogEntry[];
  hasNewRateLimitError: boolean;
  devModelOverride: string | null;

  isEncounterModalVisible: boolean;
  generatedEncounter: Monster[] | null;
  encounterSources: GroundingChunk[] | null;
  encounterError: string | null;

  currentEnemies: CombatCharacter[] | null;

  saveVersion?: string;
  saveTimestamp?: number;

  lastInteractedNpcId: string | null;
  lastNpcResponse: string | null;

  inspectedTileDescriptions: Record<string, string>;

  discoveryLog: DiscoveryEntry[];
  unreadDiscoveryCount: number;
  isDiscoveryLogVisible: boolean;
  isGlossaryVisible: boolean;
  selectedGlossaryTermForModal?: string;

  npcMemory: Record<string, NpcMemory>;

  locationResidues: Record<string, DiscoveryResidue | null>;

  metNpcIds: string[];

  merchantModal: {
    isOpen: boolean;
    merchantName: string;
    merchantInventory: import('./items').Item[];
    economy?: EconomyState; // Added economy state
  };

  questLog: Quest[];
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
  slot: import('./items').EquipmentSlotType;
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

export interface ShowEncounterModalPayload {
  encounter?: Monster[];
  sources?: GroundingChunk[];
  error?: string;
  partyUsed?: import('./character').TempPartyMember[];
}

export interface StartBattleMapEncounterPayload {
  monsters: Monster[];
}

export interface QuickTravelPayload {
  destination: { x: number; y: number };
  durationSeconds: number;
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
    slot?: import('./items').EquipmentSlotType;
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
    merchantInventory?: import('./items').Item[];
    cost?: number;
    value?: number;
    item?: import('./items').Item;
    // New payloads for dynamic generation. The village context is typed so the
    // Gemini prompts can safely lean on integration cues without guessing at
    // available fields.
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

    [key: string]: any;
  };
}

export interface GlossaryDisplayItem {
  icon: string;
  meaning: string;
  category?: string;
}

export interface GlossaryEntry {
  id: string;
  title: string;
  category: string;
  tags?: string[];
  excerpt?: string;
  aliases?: string[];
  seeAlso?: string[];
  filePath: string;
  subEntries?: GlossaryEntry[];
}

export interface SeededFeatureConfig {
  id: string;
  name?: string;
  icon: string;
  color: string;
  sizeRange: [number, number];
  numSeedsRange: [number, number];
  adjacency?: {
    icon?: string;
    color?: string;
  };
  zOffset?: number;
  scatterOverride?: Array<{ icon: string; density: number; color?: string; allowedOn?: string[] }>;
  generatesEffectiveTerrainType?: string;
  shapeType?: 'circular' | 'rectangular';
}

export interface MicroFeatureVisual {
  icon: string;
  color?: string;
  density: number;
  allowedOn?: string[];
}

export interface BiomeVisuals {
  baseColors: string[];
  pathColor: string;
  pathIcon?: string;
  pathAdjacency?: {
    color?: string;
    scatter?: MicroFeatureVisual[];
  };
  seededFeatures?: SeededFeatureConfig[];
  scatterFeatures: MicroFeatureVisual[];
  caTileVisuals?: {
    wall: { color: string; icon: string | null };
    floor: { color: string; icon: string | null };
  };
}

export interface PathDetails {
  mainPathCoords: Set<string>;
  pathAdjacencyCoords: Set<string>;
}

export interface GlossaryTooltipProps {
  termId: string;
  children: React.ReactElement<any>;
  onNavigateToGlossary?: (termId: string) => void;
}

// Village scene integration payloads live here to keep the UI contract
// explicit. Having a shared type prevents accidental "any" leaks when we send
// interaction data to higher-level action dispatchers.
export interface VillageActionContext {
  worldX: number;
  worldY: number;
  biomeId: string;
  buildingId?: string;
  buildingType: VillageTileType;
  description: string;
  integrationProfileId: string;
  integrationPrompt: string;
  // Extra narrative cues baked into the integration profile so that
  // downstream systems (Gemini calls, UI flavor text) can lean on the
  // same cultural hooks without recalculating them.
  integrationTagline: string;
  culturalSignature: string;
  encounterHooks: string[];
}
