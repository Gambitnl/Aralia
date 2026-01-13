/**
 * @file src/state/initialState.ts
 * Defines the initial state for the application.
 */

import { GameState, GamePhase, SuspicionLevel, UnderdarkState } from '../types';
import { DEFAULT_WEATHER } from '../systems/environment/EnvironmentSystem';
import { STARTING_LOCATION_ID, ITEMS as _ITEMS, CLASSES_DATA as _CLASSES_DATA, NPCS, COMPANIONS } from '../constants';
import { getDummyParty, initialInventoryForDummyCharacter } from '../data/dev/dummyCharacter';
import { FACTIONS, INITIAL_FACTION_STANDINGS } from '../data/factions';
import { DEITIES } from '../data/deities';
import { TEMPLES } from '../data/temples';
import { canUseDevTools } from '../utils/permissions';
import { SUBMAP_DIMENSIONS } from '../config/mapConfig';
import * as SaveLoadService from '../services/saveLoadService';
import { INITIAL_TRADE_ROUTES } from '../data/tradeRoutes';
import { createEmptyHistory } from '../utils/historyUtils';
import { NavalState } from '../types/naval';
import type { DivineFavor } from '../types/religion';

// Helper function to create a date at 07:00 AM on an arbitrary fixed date
const createInitialGameTime = (): Date => {
    const initialTime = new Date(Date.UTC(351, 0, 1, 7, 0, 0, 0));
    return initialTime;
};

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
};

const INITIAL_DIVINE_FAVOR: Record<string, DivineFavor> = DEITIES.reduce((acc, deity) => {
    acc[deity.id] = {
        score: 0,
        rank: 'Neutral',
        consecutiveDaysPrayed: 0,
        history: [],
        blessings: [],
    };
    return acc;
}, {} as Record<string, DivineFavor>);

export const initialGameState: GameState = {
    phase: canUseDevTools() && getDummyParty() && getDummyParty().length > 0 && !SaveLoadService.hasSaveGame() ? GamePhase.PLAYING : GamePhase.MAIN_MENU,
    party: canUseDevTools() && !SaveLoadService.hasSaveGame() ? getDummyParty() : [],
    tempParty: canUseDevTools() && !SaveLoadService.hasSaveGame() ? getDummyParty().map(p => ({ id: p.id || crypto.randomUUID(), level: p.level || 1, classId: p.class.id })) : null,
    inventory: canUseDevTools() && !SaveLoadService.hasSaveGame() ? [...initialInventoryForDummyCharacter] : [],
    gold: 10, // Default starting gold
    currentLocationId: STARTING_LOCATION_ID,
    subMapCoordinates: canUseDevTools() && !SaveLoadService.hasSaveGame() ? { x: Math.floor(SUBMAP_DIMENSIONS.cols / 2), y: Math.floor(SUBMAP_DIMENSIONS.rows / 2) } : null,
    messages: [],
    isLoading: canUseDevTools() && !!getDummyParty() && getDummyParty().length > 0 && !SaveLoadService.hasSaveGame(),
    loadingMessage: canUseDevTools() && !!getDummyParty() && getDummyParty().length > 0 && !SaveLoadService.hasSaveGame() ? "Aralia is weaving fate..." : null,
    isImageLoading: false,
    error: null,
    worldSeed: Date.now(), // Default seed, will be overwritten on new game
    mapData: null,
    isMapVisible: false,
    isSubmapVisible: false,
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
    gameTime: createInitialGameTime(),

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
    isDevModeEnabled: false,
    banterDebugLog: [],
    // TODO(2026-01-03 pass 5 Codex-CLI): archived banters placeholder until persistent banter logging stabilizes.
    archivedBanters: [],

    // Encounter Modal State
    isEncounterModalVisible: false,
    generatedEncounter: null,
    encounterSources: null,
    encounterError: null,

    // Battle Map State
    currentEnemies: null,

    // Fields for save/load
    saveVersion: undefined,
    saveTimestamp: undefined,

    // NPC interaction context
    lastInteractedNpcId: null,
    lastNpcResponse: null,

    inspectedTileDescriptions: {},

    // Discovery Journal State
    discoveryLog: [],
    unreadDiscoveryCount: 0,
    isDiscoveryLogVisible: false,
    isGlossaryVisible: false,
    selectedGlossaryTermForModal: undefined,

    // NPC Memory
    npcMemory: Object.keys(NPCS).reduce((acc, npcId) => {
        const npcData = NPCS[npcId];
        acc[npcId] = {
            disposition: 0,
            knownFacts: [],
            suspicion: SuspicionLevel.Unaware,
            goals: npcData?.goals ? [...npcData.goals] : [],
            // TODO(2026-01-03 pass 4 Codex-CLI): npcMemory interactions/attitude/discussedTopics placeholders until NPC logging is formalized.
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

    // Quest System
    questLog: [],
    isQuestLogVisible: false,

    // Notoriety System
    notoriety: {
        globalHeat: 0,
        localHeat: {},
        knownCrimes: [],
        // TODO(2026-01-03 pass 4 Codex-CLI): bounties stubbed to satisfy NotorietyState; feed from crime system when available.
        bounties: [],
    },

    worldHistory: createEmptyHistory(),

    // Town Exploration
    townState: null,
    townEntryDirection: null,

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

    // Depthcrawler: Underdark System
    // Identity System (initialized lazily or on demand)
    playerIdentity: undefined,

    // Underdark System
    underdark: INITIAL_UNDERDARK_STATE,

    // Environment System
    environment: DEFAULT_WEATHER,

    // Dialogist: Dialogue System
    activeDialogueSession: null,
    isDialogueInterfaceOpen: false,

    // Lockpicking Modal State
    isLockpickingModalVisible: false,
    activeLock: null,

    // Dice Roller Modal State
    isDiceRollerVisible: false,
    visualDiceEnabled: true, // Default to enabled for immersive experience     

    banterCooldowns: {},

    // Naval System
    naval: INITIAL_NAVAL_STATE,

    // UI
    isNavalDashboardVisible: false,
    isNobleHouseListVisible: false,
    isTradeRouteDashboardVisible: false,
};
