/**
 * Consolidated type exports for Aralia RPG.
 * Core primitives live in ./core, item definitions in ./items, and character-focused
 * types in ./character. Domain-specific modules (combat, spells, deity, factions, etc.)
 * remain in sibling files and are re-exported here for convenience.
 */
import React from 'react';
import type { VillageTileType } from '../services/villageGenerator';

import {
  AbilityScoreName,
  AbilityScores,
  Skill,
  GamePhase,
} from './core';
import {
  EquipmentSlotType,
  ArmorCategory,
  Mastery,
  ItemEffect,
  Item,
  ItemContainer,
  InventoryEntry,
  CanEquipResult,
} from './items';
import {
  Race,
  RaceDataBundle,
  ElvenLineage,
  GnomeSubrace,
  GiantAncestryBenefit,
  FiendishLegacy,
  FiendishLegacyType,
  DraconicAncestorType,
  DraconicDamageType,
  DraconicAncestryInfo,
  Class,
  ClassFeature,
  FightingStyle,
  DivineOrderOption,
  PrimalOrderOption,
  WarlockPatronOption,
  ArmorProficiencyLevel,
  ResourceVial,
  SpellSlots,
  SpellbookData,
  ResetCondition,
  LimitedUseAbility,
  LimitedUses,
  RacialSelectionData,
  TransportMode,
  Feat,
  FeatSpellRequirement,
  FeatGrantedSpell,
  FeatSpellBenefits,
  FeatPrerequisiteContext,
  LevelUpChoices,
  PlayerCharacter,
  SelectableClass,
  TempPartyMember,
  MissingChoice,
  MagicInitiateSource,
  RacialSpell,
} from './character';
import { Faction, PlayerFactionStanding } from './factions';
import { Companion } from './companions';
import { DivineFavor, Temple } from './deity';
import type { CombatCharacter, CharacterStats, Position, CombatState } from './combat';

export * from './core';
export * from './items';
export * from './character';
export * from './spells';
export * from './deity';
export * from './factions';
export * from './companions';
export * from './planes';
export type { CombatCharacter, CharacterStats, Position, CombatState };

// -----------------------------------------------------------------------------
// World and NPC types
// -----------------------------------------------------------------------------
export interface LocationDynamicNpcConfig {
  possibleNpcIds: string[];
  maxSpawnCount: number;
  baseSpawnChance: number;
}

export interface Exit {
  direction: string;
  targetId: string;
  travelTime?: number;
  description?: string;
  isHidden?: boolean;
}

export interface Location {
  id: string;
  name: string;
  baseDescription: string;
  exits: { [direction: string]: string | Exit }; // Allow both string (legacy) and Exit object
  itemIds?: string[];
  npcIds?: string[];
  dynamicNpcConfig?: LocationDynamicNpcConfig;
  mapCoordinates: { x: number; y: number };
  biomeId: string;
  gossipLinks?: string[];
  planeId?: string; // Optional, defaults to 'material'
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
  metadata?: {
    companionId?: string;
    reactionType?: string;
    [key: string]: any;
  };
}

export interface Biome {
  id: string;
  name: string;
  color: string;
  rgbaColor?: string;
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

export interface PointOfInterest {
  /** Unique ID to reference this POI within UI elements. */
  id: string;
  /** Human readable name shown inside tooltips and legends. */
  name: string;
  /** Short description for hover tooltips. */
  description: string;
  /** World-map aligned coordinates (tile space, not pixels). */
  coordinates: { x: number; y: number };
  /** Emoji or small string icon used on the map surface. */
  icon: string;
  /** Category helps the legend group similar markers. */
  category: 'settlement' | 'landmark' | 'ruin' | 'cave' | 'wilderness';
  /** Optional link back to a formal Location entry. */
  locationId?: string;
}

export interface MapMarker {
  /** ID of the originating POI or generated marker. */
  id: string;
  /** Tile-space coordinates where the marker should render. */
  coordinates: { x: number; y: number };
  /** Icon rendered on both the minimap canvas and the large map grid. */
  icon: string;
  /** Text label shown in tooltips or alongside the icon. */
  label: string;
  /** Optional grouping used by the legend to style or describe the marker. */
  category?: string;
  /** Whether the marker should render as "known" (tile discovered or player present). */
  isDiscovered: boolean;
  /** Associated Location ID, if any, to aid tooltips. */
  relatedLocationId?: string;
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
  /** Optional world-region hint for UI grouping */
  regionHint?: string;
  /** Narrative tag such as "Main", "Side", "Guild" for filtering */
  questType?: 'Main' | 'Side' | 'Guild' | 'Dynamic';
}

export interface QuestTemplate extends Omit<Quest, 'status' | 'objectives' | 'dateStarted' | 'dateCompleted'> {
  objectives: Array<Omit<QuestObjective, 'isCompleted'>>;
  repeatable?: boolean;
}

export interface GeminiLogEntry {
  timestamp: Date;
  functionName: string;
  prompt: string;
  response: string;
}

// -----------------------------------------------------------------------------
// Crime & notoriety
// -----------------------------------------------------------------------------
export enum HeatLevel {
  Unknown = 0,    // No one knows you
  Suspected = 1,  // Rumors, guards watch you
  Wanted = 2,     // Active arrest on sight
  Hunted = 3,     // Bounty hunters dispatched
}

export enum CrimeType {
  Theft = 'Theft',
  Assault = 'Assault',
  Murder = 'Murder',
  Trespassing = 'Trespassing',
  Vandalism = 'Vandalism',
}

export interface Crime {
  id: string;
  type: CrimeType;
  locationId: string;
  timestamp: number;
  severity: number; // 1-10 scale
  witnessed: boolean;
}

export interface NotorietyState {
  globalHeat: number;
  localHeat: Record<string, number>; // locationId -> heat level
  knownCrimes: Crime[];
}

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
  | 'HARVEST_RESOURCE' // New
  | 'ANALYZE_SITUATION'
  | 'wait'
  | 'TOGGLE_GAME_GUIDE'
  | 'UPDATE_CHARACTER_CHOICE'
  | 'ACCEPT_QUEST'
  | 'UPDATE_QUEST_OBJECTIVE'
  | 'COMPLETE_QUEST'
  | 'TOGGLE_QUEST_LOG'
  | 'PRAY';

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
  character: PlayerCharacter;
  mapData: MapData;
  dynamicLocationItemIds: Record<string, string[]>;
  initialLocationDescription: string;
  initialSubMapCoordinates: { x: number; y: number };
  initialActiveDynamicNpcIds: string[] | null;
  startingInventory: Item[];
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
  party: PlayerCharacter[];
  tempParty: TempPartyMember[] | null;
  inventory: Item[];
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
    character: PlayerCharacter | null;
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
    merchantInventory: Item[];
    economy?: EconomyState; // Added economy state
  };

  notoriety: NotorietyState;

  questLog: Quest[];
  isQuestLogVisible: boolean;
  notifications: Notification[];

  // Intriguer: Faction System
  factions: Record<string, Faction>; // All active factions in the world
  playerFactionStandings: Record<string, PlayerFactionStanding>; // Player's standing with factions
  companions: Record<string, Companion>; // Keyed by Companion ID

  // Templar: Religion System
  divineFavor: Record<string, DivineFavor>; // Keyed by Deity ID
  temples: Record<string, Temple>; // Keyed by Temple ID (or Location ID)

  /** Town exploration state - present when in VILLAGE_VIEW phase */
  townState: import('./town').TownState | null;
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

// --- NEW INTERFACE FOR VILLAGE CONTEXT ---
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

// Notifications
export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  duration?: number;
}
