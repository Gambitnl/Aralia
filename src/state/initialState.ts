// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 13:32:10
 * Dependents: App.tsx, state/appState.ts
 * Imports: 15 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/state/initialState.ts
 * Defines the initial state for the application.
 * Unified source of truth for the starting GameState.
 */

import { GameState, GamePhase, SuspicionLevel, UnderdarkState } from '../types';
import { withLegacyWeatherBridge } from '../types/environment';
import { DEFAULT_WEATHER } from '../systems/environment/EnvironmentSystem';
import { STARTING_LOCATION_ID } from '../data/world/locations';
import { NPCS } from '../data/world/npcs';
import { COMPANIONS } from '../data/companions';
import { FACTIONS, INITIAL_FACTION_STANDINGS } from '../data/factions';
import { DEITIES } from '../data/deities';
import { TEMPLES } from '../data/temples';
import { INITIAL_TRADE_ROUTES } from '../data/tradeRoutes';
import { createEmptyHistory } from '../utils/historyUtils';
import { INITIAL_GAME_ENTRY_STATE } from '../systems/gameEntry/types';
import { NavalState } from '../types/naval';
import type { DivineFavor } from '../types/religion';
import { getGameDay } from '../utils/core';

// Helper function to create a date at 07:00 AM on an arbitrary fixed date
const createInitialGameTime = (): Date => {
    const initialTime = new Date(Date.UTC(351, 0, 1, 7, 0, 0, 0));
    return initialTime;
};

// Cache the initial time so related defaults (like rest tracking) stay in sync.
const initialGameTime = createInitialGameTime();

const INITIAL_UNDERDARK_STATE: UnderdarkState = {
    currentDepth: 0,
    currentBiomeId: 'cavern_standard', // Default start
    lightLevel: 'bright', // Surface default
    activeLightSources: [],
    faerzressLevel: 0,
    wildMagicChance: 0,
    sanity: {
        current: 100,
        max: 100,
        madnessLevel: 0
    }
};

const INITIAL_NAVAL_STATE: NavalState = {
    playerShips: [],
    activeShipId: null,
    currentVoyage: null,
    knownPorts: [],
    pendingSeaEncounter: null,
};

export const INITIAL_DIVINE_FAVOR: Record<string, DivineFavor> = DEITIES.reduce((acc, deity) => {
    acc[deity.id] = {
        score: 0,
        rank: 'Neutral',
        consecutiveDaysPrayed: 0,
        history: [],
        blessings: [],
    };
    return acc;
}, {} as Record<string, DivineFavor>);

// RALPH: The Genesis State.
// Defines the exact starting conditions for a new game.
// Dev dummy auto-start is now handled after App mounts so this static state does
// not import the generated item registry during saved main-menu startup.
export const initialGameState: GameState = {
    phase: GamePhase.MAIN_MENU,
    autoSaveEnabled: true,
    party: [],
    tempParty: null,
    inventory: [],
    gold: 10, // Default starting gold
    currentLocationId: STARTING_LOCATION_ID,
    messages: [],
    isLoading: false,
    loadingMessage: null,
    isImageLoading: false,
    error: null,
    worldSeed: Date.now(), // Default seed, will be overwritten on new game
    isMapVisible: false,
    isLongRestModalVisible: false,
    isShortRestModalVisible: false,
    isThreeDVisible: false,
    isPartyOverlayVisible: false,
    isNpcTestModalVisible: false,
    isLogbookVisible: false,
    isGameGuideVisible: false,
    isThievesGuildVisible: false,
    dynamicLocationItemIds: {},
    currentLocationActiveDynamicNpcIds: null,
    geminiGeneratedActions: null,
    characterSheetModal: {
        isOpen: false,
        character: null,
    },
    gameTime: initialGameTime,
    // Track party-wide short rest pacing (daily cap + cooldown).
    shortRestTracker: {
        restsTakenToday: 0,
        lastRestDay: getGameDay(initialGameTime),
        lastRestEndedAtMs: null,
    },

    // Dev Mode specific state
    isDevMenuVisible: false,
    isPartyEditorVisible: false,
    isGeminiLogViewerVisible: false,
    geminiInteractionLog: [],
    isOllamaLogViewerVisible: false,
    isUnifiedLogViewerVisible: false,
    ollamaInteractionLog: [],
    hasNewRateLimitError: false,
    isOllamaDependencyModalVisible: false,
    devModelOverride: null,
    // Dev builds (npm run dev) start with dev mode ON so debug surfaces are one
    // click away; production builds still start with it off. Vitest also sets
    // DEV=true — tests that need it off should override explicitly.
    isDevModeEnabled: import.meta.env.DEV === true,
    banterDebugLog: [],
    archivedBanters: [],

    // Encounter Modal State
    isEncounterModalVisible: false,
    generatedEncounter: null,
    encounterSources: null,
    encounterError: null,

    // Battle Map State
    currentEnemies: null,
    // Unsupported production encounters carry a structured reason into the
    // inert source-gap screen instead of preparing anonymous enemies.
    battlefieldSourceGap: null,
    // Pre-extracted 3D battle map data to override procedural generation.
    // Captured from ground mode terrain centered around player-hostile collision.
    extractedBattleMap: null,

    // Fields for save/load
    saveVersion: undefined,
    saveTimestamp: undefined,

    // NPC interaction context
    lastInteractedNpcId: null,
    lastNpcResponse: null,

    // Runtime adventure log (Oracle-DM substrate)
    adventureLog: [],

    // Discovery Journal State
    discoveryLog: [],
    unreadDiscoveryCount: 0,
    isDiscoveryLogVisible: false,
    isGlossaryVisible: false,
    selectedGlossaryTermForModal: undefined,

    // NPC Memory
    // RALPH: Socio-Cognitive Hub.
    // Seeds the "Memory" of every static NPC. 
    // Tracking disposition, secrets, goals, and interaction history.
    npcMemory: Object.keys(NPCS).reduce((acc, npcId) => {
        const npcData = NPCS[npcId];
        acc[npcId] = {
            disposition: 0,
            knownFacts: [],
            suspicion: SuspicionLevel.Unaware,
            goals: npcData?.goals ? [...npcData.goals] : [],
            interactions: [],
            attitude: 0,
            discussedTopics: {},
            lastInteractionDate: null,
        };
        return acc;
    }, {} as GameState['npcMemory']),

    // World State
    locationResidues: {},

    // Character Logbook
    metNpcIds: [],

    // Merchant State
    merchantModal: {
        isOpen: false,
        merchantName: '',
        merchantInventory: [],
    },

    economy: {
        marketEvents: [],
        globalInflation: 0,
        regionalWealth: {},
        tradeRoutes: INITIAL_TRADE_ROUTES,
        // Legacy fields for backward compatibility
        marketFactors: {
            scarcity: [],
            surplus: []
        },
        buyMultiplier: 1.0,
        sellMultiplier: 0.5,
        activeEvents: []
    },

    // Economy: Investments & Information Delivery
    playerInvestments: [],
    pendingCouriers: [],
    businesses: {},
    worldBusinesses: {},

    // Quest System
    questLog: [],
    isQuestLogVisible: false,

    // Town notice board (living-world news modal)
    isNoticeBoardVisible: false,

    // Town broadsheet (living-world newspaper modal)
    isBroadsheetVisible: false,
    // No frozen broadsheet keepsake is being read by default.
    broadsheetSnapshot: undefined,

    // Notoriety System
    notoriety: {
        globalHeat: 0,
        localHeat: {},
        knownCrimes: [],
        bounties: [],
    },

    // Daily world simulation starts with no active rumor payloads. Keeping the
    // array present lets rumor producers append to a known collection while old
    // saves are still healed at the app reducer boundary.
    activeRumors: [],
    worldHistory: createEmptyHistory(),
    townSim: {}, // living-world town sim registry; towns added when first tracked

    // Notification System
    notifications: [],

    // Faction System
    factions: FACTIONS,
    playerFactionStandings: INITIAL_FACTION_STANDINGS,

    // Companion System
    companions: COMPANIONS,

    // Religion System
    religion: {
        divineFavor: { ...INITIAL_DIVINE_FAVOR },
        discoveredDeities: [],
        activeBlessings: [],
    },
    // Legacy: keep flat map for compatibility with older flows
    divineFavor: { ...INITIAL_DIVINE_FAVOR },
    temples: TEMPLES.reduce((acc, temple) => {
        acc[temple.id] = temple;
        return acc;
    }, {} as GameState['temples']),

    // Shadowbroker: Crime System
    fences: {},
    thievesGuild: {
        memberId: 'player',
        guildId: 'shadow_hands',
        rank: 0,
        reputation: 0,
        activeJobs: [],
        availableJobs: [],
        completedJobs: [],
        servicesUnlocked: []
    },

    // Linker: World Coherence System
    dynamicLocations: {},
    // Registry for procedurally generated NPCs.
    generatedNpcs: {},
    // NPCs the party has defeated in combat; gates their talk/conversation.
    defeatedNpcIds: [],

    // Depthcrawler: Underdark System
    // Identity System (initialized lazily or on demand)
    playerIdentity: undefined,

    // Underdark System
    underdark: INITIAL_UNDERDARK_STATE,

    // Environment System
    // Keep the legacy string bridge present on fresh saves while the reducer
    // and consumers keep using the structured weather object as the source of truth.
    environment: withLegacyWeatherBridge(DEFAULT_WEATHER),

    // Dialogist: Dialogue System
    activeDialogueSession: null,
    isDialogueInterfaceOpen: false,
    activeConversation: null,
    gameEntry: INITIAL_GAME_ENTRY_STATE,

    // Lockpicking Modal State
    isLockpickingModalVisible: false,
    activeLock: null,
    // Puzzle Runtime Modal State
    isPuzzleRuntimeVisible: false,
    activePuzzle: null,

    // Dice Roller Modal State
    isDiceRollerVisible: false,
    visualDiceEnabled: true, // Default to enabled for immersive experience     

    banterCooldowns: {},

    // Naval System
    naval: INITIAL_NAVAL_STATE,

    // UI
    isNavalDashboardVisible: false,
    isThievesGuildSafehouseVisible: false,
    isNobleHouseListVisible: false,
    isTradeRouteDashboardVisible: false,
    isInvestmentBoardVisible: false,
    isEconomyLedgerVisible: false,
    isCourierPouchVisible: false,

    // 3D World Transition (world-3d-ui)
    worldViewMode: 'atlas' as const,
    mapSurface: 'classic' as const,
    playerWorldPos: null,
    entry3DAnchor: null,
    // Canonical player presence (cell-native world, Stage 2). Source of truth for
    // the player's atlas cell + Locale position; null until spawn. `currentLocationId`
    // remains the derived legacy shadow readers use this stage.
    playerCell: null,
    // Ground-mode resume anchor
    // This stays null until the 3D ground renderer reports tile-local meters.
    // It must remain separate from playerWorldPos, which stores continent meters.
    playerGroundPos: null,

    // Worldforge replay log
    // Fresh games have no plot edits yet. Runtime actions append deltas here so
    // regenerated village geometry can replay saved player/world changes.
    worldforgeDeltas: [],

    // Generated-world encounter receipts
    // Fresh games have not consumed any deterministic settlement patrol events.
    // These are saved separately from terrain deltas so combat history cannot be
    // mistaken for a mutation of the generated town.
    worldforgeEncounterReceipts: [],

    // SP4 discovery: no hidden off-map places revealed yet.
    discoveredHiddenSites: [],
};
