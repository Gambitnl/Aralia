
/**
 * @file src/types/index.ts
 * This file contains all the core TypeScript type definitions and interfaces
 * used throughout the Aralia RPG application.
 */
// TODO: Implement Zod schemas for all game data structures (spells, NPCs, items) to ensure data integrity and provide better error messages
import React from 'react';
import { CombatCharacter, CharacterStats, Position, CombatState } from './combat'; // Adjusted import path for sibling file
import type { VillageTileType } from '../services/villageGenerator';

export type { CombatCharacter, CharacterStats, Position, CombatState };

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

// Core D&D Attributes
export type AbilityScoreName =
  | 'Strength'
  | 'Dexterity'
  | 'Constitution'
  | 'Intelligence'
  | 'Wisdom'
  | 'Charisma';

export interface AbilityScores {
  Strength: number;
  Dexterity: number;
  Constitution: number;
  Intelligence: number;
  Wisdom: number;
  Charisma: number;
}

export interface Skill {
  id: string;
  name: string;
  ability: AbilityScoreName;
}

export interface RacialAbilityBonus {
  ability: AbilityScoreName;
  bonus: number;
}

export type ElvenLineageType = 'drow' | 'high_elf' | 'wood_elf';

export interface ElvenLineageBenefit {
  level: number;
  description?: string;
  cantripId?: string;
  spellId?: string;
  speedIncrease?: number;
  darkvisionRange?: number;
  canSwapCantrip?: boolean;
  swappableCantripSource?: 'wizard';
}

export interface ElvenLineage {
  id: ElvenLineageType;
  name: string;
  description: string;
  benefits: ElvenLineageBenefit[];
}

export type GnomeSubraceType = 'forest_gnome' | 'rock_gnome' | 'deep_gnome';

export interface GnomeSubrace {
  id: GnomeSubraceType;
  name: string;
  description: string;
  traits: string[];
  grantedCantrip?: { id: string; spellcastingAbilitySource: 'subrace_choice' };
  grantedSpell?: {
    id: string;
    spellcastingAbilitySource: 'subrace_choice';
    usesDescription: string;
    level: number;
  };
  superiorDarkvision?: boolean;
}

export type GiantAncestryType = 'Cloud' | 'Fire' | 'Frost' | 'Hill' | 'Stone' | 'Storm';

export interface GiantAncestryBenefit {
  id: GiantAncestryType;
  name: string;
  description: string;
}

export type FiendishLegacyType = 'abyssal' | 'chthonic' | 'infernal';

export interface FiendishLegacy {
  id: FiendishLegacyType;
  name: string;
  description: string;
  level1Benefit: {
    resistanceType: string;
    cantripId: string;
  };
  level3SpellId: string;
  level5SpellId: string;
}

export interface RacialSpell {
  minLevel: number;
  spellId: string;
}

export interface Race {
  id: string;
  name: string;
  description: string;
  abilityBonuses?: RacialAbilityBonus[];
  traits: string[];
  elvenLineages?: ElvenLineage[];
  gnomeSubraces?: GnomeSubrace[];
  giantAncestryChoices?: GiantAncestryBenefit[];
  fiendishLegacies?: FiendishLegacy[];
  imageUrl?: string;
  racialSpellChoice?: {
    traitName: string;
    traitDescription: string;
  };
  knownSpells?: RacialSpell[];
}

export type DraconicAncestorType =
  | 'Black'
  | 'Blue'
  | 'Brass'
  | 'Bronze'
  | 'Copper'
  | 'Gold'
  | 'Green'
  | 'Red'
  | 'Silver'
  | 'White';
export type DraconicDamageType =
  | 'Acid'
  | 'Lightning'
  | 'Fire'
  | 'Poison'
  | 'Cold';

export interface DraconicAncestryInfo {
  type: DraconicAncestorType;
  damageType: DraconicDamageType;
}

export interface ClassFeature {
  id: string;
  name: string;
  description: string;
  levelAvailable: number;
}

export interface FightingStyle extends ClassFeature { }

export interface DivineOrderOption {
  id: 'Protector' | 'Thaumaturge';
  name: string;
  description: string;
}

export interface PrimalOrderOption {
  id: 'Magician' | 'Warden';
  name: string;
  description: string;
}

export interface WarlockPatronOption {
  id: string;
  name: string;
  description: string;
}

export type ArmorProficiencyLevel = 'unarmored' | 'light' | 'medium' | 'heavy';

export interface Class {
  id: string;
  name: string;
  description: string;
  hitDie: number;
  primaryAbility: AbilityScoreName[];
  savingThrowProficiencies: AbilityScoreName[];
  skillProficienciesAvailable: string[];
  numberOfSkillProficiencies: number;
  armorProficiencies: string[];
  weaponProficiencies: string[];
  weaponMasterySlots?: number;
  startingEquipment?: string[];
  features: ClassFeature[];
  fightingStyles?: FightingStyle[];
  divineOrders?: DivineOrderOption[];
  primalOrders?: PrimalOrderOption[];
  warlockPatrons?: WarlockPatronOption[];
  spellcasting?: {
    ability: AbilityScoreName;
    knownCantrips: number;
    knownSpellsL1: number;
    spellList: string[];
  };
  statRecommendationFocus?: AbilityScoreName[];
  statRecommendationDetails?: string;
  recommendedPointBuyPriorities?: AbilityScoreName[];
}

export type EquipmentSlotType =
  | 'Head' | 'Neck' | 'Torso' | 'Cloak' | 'Belt'
  | 'MainHand' | 'OffHand' | 'Wrists' | 'Ring' | 'Ring1' | 'Ring2' | 'Feet' | 'Legs' | 'Hands';

export interface ResourceVial {
  current: number;
  max: number;
}

export type SpellSlots = Record<`level_${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`, ResourceVial>;

export interface SpellbookData {
  knownSpells: string[];
  preparedSpells: string[];
  cantrips: string[];
}

export type ResetCondition = 'short_rest' | 'long_rest' | 'daily' | 'combat';

export interface LimitedUseAbility {
  name: string;
  current: number;
  max: number | 'proficiency_bonus' | 'charisma_mod' | 'strength_mod' | 'dexterity_mod' | 'constitution_mod' | 'intelligence_mod' | 'wisdom_mod';
  resetOn: ResetCondition;
}

export type LimitedUses = Record<string, LimitedUseAbility>;

export interface RacialSelectionData {
  choiceId?: string;
  spellAbility?: AbilityScoreName;
  skillIds?: string[];
}

export type TransportMode = 'foot' | 'mounted';

export interface PlayerCharacter {
  id?: string;
  name: string;
  age?: number;
  ageSizeOverride?: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
  background?: string; // Background ID
  level?: number;
  xp?: number;
  proficiencyBonus?: number;
  race: Race;
  class: Class;
  abilityScores: AbilityScores;
  finalAbilityScores: AbilityScores;
  skills: Skill[];
  savingThrowProficiencies?: AbilityScoreName[];
  hp: number;
  maxHp: number;
  armorClass: number;
  speed: number;
  darkvisionRange: number;
  selectedWeaponMasteries?: string[];
  transportMode: TransportMode;
  spellcastingAbility?: 'intelligence' | 'wisdom' | 'charisma';
  spellSlots?: SpellSlots;
  spellbook?: SpellbookData;
  limitedUses?: LimitedUses;
  selectedFightingStyle?: FightingStyle;
  selectedDivineOrder?: 'Protector' | 'Thaumaturge';
  selectedDruidOrder?: 'Magician' | 'Warden';
  selectedWarlockPatron?: string;
  racialSelections?: Record<string, RacialSelectionData>;
  featChoices?: {
    // Store choices made for feats (e.g., selected ability score, spells, etc.)
    [featId: string]: {
      selectedAbilityScore?: AbilityScoreName;
      selectedSpells?: string[];
      selectedSkills?: string[];
      selectedWeapons?: string[];
      selectedTools?: string[];
      selectedDamageType?: string;
      [key: string]: any; // Allow for future choice types
    };
  };
  equippedItems: Partial<Record<EquipmentSlotType, Item>>;
}

export interface CanEquipResult {
  can: boolean;
  reason?: string;
}

export type ArmorCategory = 'Light' | 'Medium' | 'Heavy' | 'Shield';

export interface Mastery {
  id: string;
  name: string;
  description: string;
}

export type ItemEffect =
  | { type: 'heal'; value: number; dice?: string }
  | { type: 'buff'; stat: AbilityScoreName; value: number; duration?: number }
  | { type: 'damage'; damageType: string; dice: string }
  | { type: 'restore_resource'; resource: string; amount: number }
  | { type: 'utility'; description: string }
  | string; // For backward compatibility temporarily

export interface Item {
  id: string;
  name: string;
  description: string;
  type: 'weapon' | 'armor' | 'accessory' | 'clothing' | 'consumable' | 'potion' | 'food_drink' | 'poison_toxin' | 'tool' | 'light_source' | 'ammunition' | 'trap' | 'note' | 'book' | 'map' | 'scroll' | 'key' | 'spell_component' | 'crafting_material' | 'treasure';
  icon?: string;
  slot?: EquipmentSlotType;
  effect?: ItemEffect;
  mastery?: string;
  category?: string;
  armorCategory?: ArmorCategory;
  baseArmorClass?: number;
  addsDexterityModifier?: boolean;
  maxDexterityBonus?: number;
  strengthRequirement?: number;
  stealthDisadvantage?: boolean;
  armorClassBonus?: number;
  damageDice?: string;
  damageType?: string;
  properties?: string[];
  isMartial?: boolean;
  donTime?: string;
  doffTime?: string;
  weight?: number;
  cost?: string;
  costInGp?: number;
  isConsumed?: boolean;
  substitutable?: boolean;
  shelfLife?: string;
  nutritionValue?: number;
  perishable?: boolean;
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

  questLog: Quest[];

  // Notification System
  notifications: Array<{
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
    duration: number;
  }>;
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

export interface TempPartyMember {
  id: string;
  level: number;
  classId: string;
}

export interface SelectableClass {
  id: string;
  name: string;
}

// --- NEW INTERFACE FOR MISSING CHOICES ---
export interface MissingChoice {
  id: string; // Unique ID of the choice type (e.g., 'dragonborn_ancestry')
  label: string; // Display label (e.g., "Draconic Ancestry")
  description: string;
  type: 'race' | 'class'; // Source of the missing choice
  options: { id: string; label: string; description?: string;[key: string]: any }[];
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
