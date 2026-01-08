import { GamePhase } from './core';
import { Item } from './items';
import { PlayerCharacter, TempPartyMember } from './character';
import { Faction, PlayerFactionStanding } from './factions';
import { Companion } from './companions';
import { DivineFavor, Temple, ReligionState } from './religion';
import { Fence, GuildMembership, HeistPlan, Crime, Bounty } from './crime';
import { UnderdarkState } from './underdark';
import { EconomyState } from './economy';
import { Action, GroundingChunk } from './actions';
import { GameMessage, MapData, NpcMemory, DiscoveryResidue, Location, WorldRumor, NPC, RichNPC } from './world';
import { Quest } from './quests';
import { RitualState } from './rituals';
import { WorldHistory } from './history';
import { PlayerLegacy } from './legacy';
import { Stronghold } from './stronghold';
import { NavalState, Ship } from './naval';
import { CraftingState } from './crafting';
// TODO(lint-intent): 'Notification' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { Notification } from './ui';
import { PlayerIdentityState } from './identity';

// -----------------------------------------------------------------------------
// Notoriety State
// -----------------------------------------------------------------------------

export interface NotorietyState {
  globalHeat: number;
  localHeat: Record<string, number>; // locationId -> heat level
  knownCrimes: Crime[];
  bounties: Bounty[];
}

// -----------------------------------------------------------------------------
// Discovery Types
// -----------------------------------------------------------------------------

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
  HARVEST = 'Harvest',
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

export interface GeminiLogEntry {
  timestamp: Date;
  functionName: string;
  prompt: string;
  response: string;
}

export interface OllamaLogEntry {
  id: string;
  timestamp: Date;
  model: string;
  prompt: string;
  response: string;
  context?: any;
  isPending?: boolean;
}

// -----------------------------------------------------------------------------
// Game State
// -----------------------------------------------------------------------------

export interface GameState {
  phase: GamePhase;
  previousPhase?: GamePhase;
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
  isGameGuideVisible: boolean;
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
  isOllamaLogViewerVisible: boolean;
  isUnifiedLogViewerVisible: boolean;
  ollamaInteractionLog: OllamaLogEntry[];
  hasNewRateLimitError: boolean;
  devModelOverride: string | null;
  isDevModeEnabled: boolean;
  banterDebugLog: { timestamp: Date; check: string; result: boolean | string; details?: string }[];

  isEncounterModalVisible: boolean;
  generatedEncounter: import('./world').Monster[] | null;
  encounterSources: GroundingChunk[] | null;
  encounterError: string | null;

  currentEnemies: import('./combat').CombatCharacter[] | null;

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
    economy?: EconomyState;
  };

  templeModal?: {
    isOpen: boolean;
    temple: Temple | null;
  };

  economy: EconomyState;

  notoriety: NotorietyState;

  activeRumors?: WorldRumor[];

  worldHistory?: WorldHistory;

  questLog: Quest[];
  isQuestLogVisible: boolean;
  // TODO(lint-intent): The any on 'notifications' hides the intended shape of this data.
  // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
  // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
  notifications: Notification[];

  factions: Record<string, Faction>;
  playerFactionStandings: Record<string, PlayerFactionStanding>;
  companions: Record<string, Companion>;

  religion: ReligionState;

  // Deprecated: Moving to religion.favor and religion.knownDeities
  divineFavor: Record<string, DivineFavor>;

  temples: Record<string, Temple>;

  fences: Record<string, Fence>;
  thievesGuild?: GuildMembership;
  activeHeist?: HeistPlan | null;
  // TODO(lint-intent): 'activeContracts' uses 'unknown[]' because the contract shape isn't fully defined/exported yet.
  // TODO(lint-intent): Replace with 'Contract[]' once the contract type is available in a shared module.
  activeContracts?: unknown[];

  dynamicLocations: Record<string, Location>;
  dynamicNPCs?: Record<string, NPC>;
  /** Registry of procedurally generated NPCs, keyed by their ID. */
  generatedNpcs: Record<string, RichNPC>;
  playerIdentity?: PlayerIdentityState;

  legacy?: PlayerLegacy;
  strongholds?: Record<string, Stronghold>;

  underdark: UnderdarkState;

  environment?: import('./environment').WeatherState;

  isThievesGuildVisible: boolean;
  naval: NavalState;
  isNavalDashboardVisible: boolean;
  isNobleHouseListVisible: boolean;
  isTradeRouteDashboardVisible: boolean;

  activeRitual?: RitualState | null;

  townState: import('./town').TownState | null;

  townEntryDirection: 'north' | 'east' | 'south' | 'west' | null;

  activeDialogueSession: import('./dialogue').DialogueSession | null;
  isDialogueInterfaceOpen: boolean;

  // Lockpicking Modal State
  isLockpickingModalVisible: boolean;
  activeLock: import('../systems/puzzles/types').Lock | null;

  // Dice Roller Modal State
  isDiceRollerVisible: boolean;

  // User Preferences
  visualDiceEnabled: boolean;

  // Ollama Dependency Modal
  isOllamaDependencyModalVisible: boolean;

  banterCooldowns: Record<string, number>;
  // TODO(lint-intent): naval ship state is optional and currently typed loosely; define Ship shape and wire it here.
  ship?: Ship;

  // Crafting system state
  crafting?: CraftingState;

  // Interactive companion conversation state
  activeConversation?: import('./conversation').ActiveConversation | null;

  // Archive of completed banter moments
  archivedBanters: import('./companions').BanterMoment[];
}
