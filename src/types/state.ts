// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 16/07/2026, 13:27:56
 * Dependents: App.tsx, components/MapPane.tsx, components/World3D/entryCellIdentity.ts, state/appState.ts, state/reducers/craftingReducer.ts, systems/adventureLog/adventureLog.ts, systems/adventureLog/oraclePrompt.ts, systems/party/recruitConsent.ts, systems/worldforge/local/gridAtlasBridge.ts, types/index.ts, types/travelMeta.ts, utils/world/sceneUtils.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { GamePhase } from './core.js';
import { Item } from './items.js';
import { PlayerCharacter, TempPartyMember } from './character.js';
import { Faction, PlayerFactionStanding } from './factions.js';
import { Companion } from './companions.js';
import { DivineFavor, Temple, ReligionState } from './religion.js';
import { Fence, GuildMembership, HeistPlan, Crime, Bounty } from './crime/index.js';
import { UnderdarkState } from './underdark.js';
import { EconomyState } from './economy.js';
import { Action, BattlefieldSourceGapReason, GroundingChunk } from './actions.js';
import { GameMessage, MapData, NpcMemory, DiscoveryResidue, Location, WorldRumor, NPC, RichNPC } from './world.js';
import { Quest } from './quests.js';
import { RitualState } from './rituals.js';
import { WorldHistory } from './history.js';
import { PlayerLegacy } from './legacy.js';
import { Stronghold } from './stronghold.js';
import { NavalState, Ship } from './naval.js';
import { CraftingState } from './crafting.js';
import { JournalState } from './journal.js';
import type { WorldDelta } from '../systems/worldforge/delta/types.js';
import type { WorldforgeEncounterReceipt } from '../systems/combat/worldScenario/worldforgeEncounterReceipt.js';
import type { Notification } from './ui.js';
import { PlayerIdentityState } from './identity.js';

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

/**
 * The kind of runtime event an adventure-log entry records. Kept small and
 * closed so the Oracle DM can group / prioritize the "story so far".
 */
export type AdventureLogKind =
  | 'opening'
  | 'quest'
  | 'combat'
  | 'travel'
  | 'met-npc'
  | 'discovery'
  | 'rest';

/**
 * A single, append-only record of something that happened to THIS party, in
 * play order. Summaries are generated from game data (never from an LLM) and
 * kept to one short sentence so the Oracle can recap the story cheaply.
 *
 * This is the runtime "adventure log" substrate that lets the Oracle act as a
 * Dungeon Master: recap what has happened and point at real people/places.
 */
export interface AdventureLogEntry {
  id: string;
  /** In-game day number (1-based) when the event resolved. */
  day: number;
  /** In-game clock label, e.g. "14:30". */
  time: string;
  /** Wall-clock timestamp (ms) for stable ordering across a session. */
  timestamp: number;
  kind: AdventureLogKind;
  /** One short, data-derived sentence describing what happened. */
  summary: string;
  /** IDs of NPCs referenced by this event (for follow-up suggestions). */
  npcIds?: string[];
  /** IDs of places/locations referenced by this event. */
  placeIds?: string[];
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
  /** The task profile that drove the call (e.g. 'opening_situation'). */
  taskType?: string;
  /** True when the call failed at the transport layer (model down / timeout). */
  isError?: boolean;
}

// ---------------------------------------------------------------------------
// Rest Tracking
// ---------------------------------------------------------------------------

export interface ShortRestTracker {
  restsTakenToday: number;
  lastRestDay: number;
  lastRestEndedAtMs: number | null;
}

// ---------------------------------------------------------------------------
// 3D World Transition Types (world-3d-ui)
// ---------------------------------------------------------------------------

/** View mode within PLAYING phase: 'atlas' (2D map) or '3d' (3D world). */
export type WorldViewMode = 'atlas' | '3d';

/**
 * Which 2D cartographic surface backs the exploration view:
 * - 'classic'    — the legacy GameLayout (MapPane iframe + Submap).
 * - 'worldforge' — the native ported-FMG Worldforge cartographer
 *                  (L0 atlas → L1 region → L2 local zoom chain).
 * Independent of WorldViewMode (3D vs 2D). Defaults to 'classic'.
 */
export type MapSurface = 'classic' | 'worldforge';

/** 3D world position in world meters. Used as game-state anchor for transition and marker sync. */
export interface PlayerWorldPosition {
  x: number;  // world meters (X axis)
  y: number;  // height (terrain Y)
  z: number;  // world meters (Z axis; maps to Y in 2D atlas coords)
}

/** Tile-scoped ground position in meters. Kept separate from continent-space playerWorldPos. */
export interface PlayerGroundPosition {
  tileX: number;
  tileY: number;
  xM: number;
  zM: number;
}

/**
 * Exact 3D-entry anchor (cell-native world, Stage 1). `cellId` is the atlas cell
 * to enter; `centerPx` is the optional window-center override in atlas/graph
 * PIXELS — the burg's position for a settlement (so the Locale frames the town),
 * omitted for wilderness (centers on the cell site).
 */
export interface Entry3DAnchor {
  cellId: number;
  centerPx?: readonly [number, number];
}

/**
 * Canonical player presence (cell-native world, Stage 2). The atlas Voronoi cell
 * the player occupies plus their Locale-local position. This is the SOURCE OF
 * TRUTH for where the player is; `currentLocationId` (`coord_X_Y`) is the derived
 * legacy shadow kept for legacy-reader compat. (The old `subMapCoordinates`
 * integer shadow was removed in grid-retirement slice 4a.)
 *
 * `localeCoords` is continuous Locale feet backed by `playerGroundPos` (Stage 3
 * "Locale movement"), null until a ground session engages. The structural type is
 * kept deliberately loose so the earlier submap-sub-tile widening needed no second
 * save migration.
 */
export interface PlayerCell {
  /** Atlas (FMG) Voronoi cell id the player occupies. */
  cellId: number;
  /** Locale-local position — continuous Locale feet from the ground session, or null. */
  localeCoords: { x: number; y: number } | null;
}

/**
 * A hidden off-map place the player has revealed by 3D proximity (SP4). Carries
 * the world tile where it was found so the atlas can pin it (the site itself is
 * off-map; tile-level position is enough — "near here").
 */
export interface DiscoveredHiddenSite {
  id: string;
  /**
   * Grid retirement (2026-07-01): the canonical atlas cell the discovery sits in
   * (the player's cell at reveal time). Replaces the legacy `tileX/tileY` 30×20
   * grid coords — the atlas pin is drawn straight at this cell's Voronoi site.
   */
  cellId: number;
  name?: string;
  kind?: string;
  /**
   * Sub-cell position within the cell, each in [-0.5, 0.5] from the cell center
   * (derived from the site's ground-meter position at discovery). Lets the atlas
   * pin sit where the place actually is inside its cell, not just at the cell
   * center. Optional + backward-compatible: pre-existing saves omit it and fall
   * back to the cell-center pin.
   */
  offsetX?: number;
  offsetY?: number;
}

// -----------------------------------------------------------------------------
// Game State
// -----------------------------------------------------------------------------

export interface GameState {
  phase: GamePhase;
  previousPhase?: GamePhase;
  /** User preference. If true, the game will auto-save to the autosave slot periodically. */
  autoSaveEnabled?: boolean;
  party: PlayerCharacter[];
  tempParty: TempPartyMember[] | null;
  inventory: Item[];
  gold: number;
  currentLocationId: string;
  /**
   * The settlement the player chose at the Start Point Selection step (its name +
   * region). Names the opening scene and the player's "home" town. Optional:
   * dev/skip/load flows and pre-existing saves omit it.
   */
  startTownName?: string;
  startTownRegion?: string;
  messages: GameMessage[];
  isLoading: boolean;
  loadingMessage: string | null;
  isImageLoading: boolean;
  error: string | null;
  worldSeed: number;
  // Grid retirement (2026-06-30): the 30x20 world `mapData` grid is removed from
  // game state. The world is the cell-native atlas derived from `worldSeed`
  // (`getBridgeAtlas`); position/biome/NPCs are cell-native (`playerCell`).
  /** Center point used by minimap consumers after map data changes. */
  minimapFocus?: { x: number; y: number };
  isMapVisible: boolean;
  isThreeDVisible?: boolean;
  isPartyOverlayVisible: boolean;
  /** Whether the long rest modal is currently visible to prompt racial choices. */
  isLongRestModalVisible?: boolean;
  /** Whether the short rest modal is currently visible to prompt Hit Dice spending. */
  isShortRestModalVisible?: boolean;
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
  generatedEncounter: import('./world.js').Monster[] | null;
  encounterSources: GroundingChunk[] | null;
  encounterError: string | null;

  currentEnemies: import('./combat.js').CombatCharacter[] | null;
  /** Exact reason an unsupported production encounter was withheld. */
  battlefieldSourceGap?: BattlefieldSourceGapReason | null;
  /**
   * Pre-extracted 3D battle map data to override procedural generation.
   * Captured from ground mode terrain centered around player-hostile collision.
   */
  extractedBattleMap?: import('./combat.js').BattleMapData | null;

  saveVersion?: string;
  saveTimestamp?: number;

  lastInteractedNpcId: string | null;
  lastNpcResponse: string | null;

  discoveryLog: DiscoveryEntry[];
  unreadDiscoveryCount: number;
  isDiscoveryLogVisible: boolean;

  /**
   * Append-only runtime record of what happened to THIS party, in play order.
   * The substrate the Oracle uses to act as a Dungeon Master (recap the story
   * so far, point at real people/places). Populated by reducers where events
   * resolve; see src/systems/adventureLog/. Serializes with saves.
   */
  adventureLog: AdventureLogEntry[];
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

  activeRumors: WorldRumor[];

  worldHistory: WorldHistory;

  /**
   * Living-world town sim: per-burg multi-day history (births/deaths/marriages/
   * fortunes), keyed by burgId. Empty until a town is first tracked. Advanced in
   * the ADVANCE_TIME daily loop. See src/systems/worldforge/townsim/.
   */
  townSim: import('../systems/worldforge/townsim/townSimRegistry').TownSimRegistry;

  questLog: Quest[];
  isQuestLogVisible: boolean;
  /** Whether the town notice board modal (living-world news) is open. */
  isNoticeBoardVisible: boolean;
  /** Whether the town broadsheet modal (living-world newspaper) is open. */
  isBroadsheetVisible: boolean;
  /**
   * When set, the broadsheet modal renders this FROZEN snapshot instead of
   * computing news live from the current town. JSON-serialized
   * { townName, day, news } captured when the player took a broadsheet keepsake.
   * Undefined ⇒ the modal computes live news (the in-town "Read the latest
   * broadsheet" action). Cleared on open-live and on close.
   */
  broadsheetSnapshot?: string;
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
  activeContracts?: unknown[];

  dynamicLocations: Record<string, Location>;
  dynamicNPCs?: Record<string, NPC>;
  /** Registry of procedurally generated NPCs, keyed by their ID. */
  generatedNpcs: Record<string, RichNPC>;
  /**
   * IDs of NPCs the party has defeated in combat (e.g. hostile opening-situation
   * strangers beaten in the fight they started). A defeated NPC must not cheerfully
   * replay its pre-fight threat line: the talk path gates on this, and the opening
   * conversation/threat banner is cleared when the set grows. Serialized with saves.
   */
  defeatedNpcIds: string[];
  playerIdentity?: PlayerIdentityState;

  legacy?: PlayerLegacy;
  strongholds?: Record<string, Stronghold>;

  // Economy: Investments & Information Delivery
  playerInvestments: import('./economy.js').PlayerInvestment[];
  pendingCouriers: import('./economy.js').PendingCourier[];
  businesses: Record<string, import('./business.js').BusinessState>;
  worldBusinesses: Record<string, import('./business.js').WorldBusiness>;

  underdark: UnderdarkState;

  environment?: import('./environment.js').WeatherState;

  isThievesGuildVisible: boolean;
  isThievesGuildSafehouseVisible?: boolean; // New flag for Safehouse UI
  naval: NavalState;
  isNavalDashboardVisible: boolean;
  isNobleHouseListVisible: boolean;
  isTradeRouteDashboardVisible: boolean;
  isInvestmentBoardVisible: boolean;
  isEconomyLedgerVisible: boolean;
  isCourierPouchVisible: boolean;

  activeRitual?: RitualState | null;

  activeDialogueSession: import('./dialogue.js').DialogueSession | null;
  isDialogueInterfaceOpen: boolean;

  // Lockpicking Modal State
  isLockpickingModalVisible: boolean;
  activeLock: import('../systems/puzzles/types.js').Lock | null;
  // Puzzle Runtime Modal State
  isPuzzleRuntimeVisible: boolean;
  activePuzzle: import('../systems/puzzles/types.js').Puzzle | null;

  // Dice Roller Modal State
  isDiceRollerVisible: boolean;

  // User Preferences
  visualDiceEnabled: boolean;

  // Ollama Dependency Modal
  isOllamaDependencyModalVisible: boolean;

  banterCooldowns: Record<string, number>;
  ship?: Ship;

  // Crafting system state
  crafting?: CraftingState;

  // Journal system state
  journal?: JournalState;

  // Interactive companion conversation state
  activeConversation?: import('./conversation.js').ActiveConversation | null;

  // Opening-situation entry state machine (GAME-ENTRY-SITUATION).
  // Optional + defaulted to idle so existing saves/factories load unchanged.
  gameEntry?: import('../systems/gameEntry/types.js').GameEntryState;

  // Archive of completed banter moments
  archivedBanters: import('./companions.js').BanterMoment[];

  // Party-level short rest pacing and daily tracking.
  shortRestTracker: ShortRestTracker;

  // 3D World Transition (world-3d-ui)
  /** Current view mode within PLAYING phase. Defaults to 'atlas'. */
  worldViewMode: WorldViewMode;
  /** Which 2D cartographic surface backs exploration. Defaults to 'classic'. */
  mapSurface: MapSurface;
  /** Player's 3D world position (null when not in 3D mode). */
  playerWorldPos: PlayerWorldPosition | null;
  /** Player's ground-mode camera anchor in tile-local meters, or null when unset. */
  playerGroundPos?: PlayerGroundPosition | null;
  /**
   * Exact 3D-entry anchor (cell-native world): the atlas cell to enter plus the
   * burg's world PIXEL position to center the Locale on (cells are far larger
   * than the Locale window, so a settlement is framed by its burg, not the cell
   * site). Set on map-click / start-selection, consumed by World3DWrapper,
   * cleared on 3D exit. Null → fall back to the legacy tile-derived entry.
   */
  entry3DAnchor: Entry3DAnchor | null;

  /**
   * Canonical player presence (cell-native world, Stage 2): the atlas cell +
   * Locale-local position the player occupies. SOURCE OF TRUTH — `currentLocationId`
   * (`coord_X_Y`) is the derived legacy shadow kept for legacy-reader compat.
   * Null before spawn / at the main menu. Recorded
   * at every position write (MOVE_PLAYER, START_GAME_SUCCESS, …) and backfilled on
   * load for pre-Stage-2 saves; readers are flipped onto it in Stage 3, not here.
   */
  playerCell: PlayerCell | null;

  // Worldforge replay log
  // Plot/building edits are stored as JSON-safe deltas so regenerated village
  // geometry can be replayed after loading a save.
  worldforgeDeltas: WorldDelta[];

  // Generated-world encounter history
  // A receipt records that one deterministic WorldForge encounter event has
  // already fired. It stays separate from physical deltas because combat does
  // not itself reshape the source terrain or settlement plan.
  worldforgeEncounterReceipts: WorldforgeEncounterReceipt[];

  // SP4 discovery: hidden off-map places the player has revealed by 3D proximity,
  // with the tile where found. Persisted so discoveries survive reload + pin on the atlas.
  discoveredHiddenSites: DiscoveredHiddenSite[];

  // Pillar 2, Task 8 (living ecology): frozen site paths of dungeons the party
  // has CLEARED. Default empty (every site starts uncleared). Persisted so a
  // cleared dungeon stays cleared across reload — it stops feeding the danger
  // overlay + raid pressure and flips its rumors to the "cleared" variants.
  // Each entry is a dungeon site's frozen SeedPath (an opaque string).
  clearedDungeons?: string[];
}
