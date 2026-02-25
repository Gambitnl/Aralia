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
import { JournalState } from './journal';
import { Notification } from './ui';
import { PlayerIdentityState } from './identity';
export interface NotorietyState {
    globalHeat: number;
    localHeat: Record<string, number>;
    knownCrimes: Crime[];
    bounties: Bounty[];
}
export declare enum DiscoveryType {
    LOCATION_DISCOVERY = "Location Discovery",
    NPC_INTERACTION = "NPC Interaction",
    ITEM_ACQUISITION = "Item Acquired",
    ITEM_USED = "Item Used",
    ITEM_EQUIPPED = "Item Equipped",
    ITEM_UNEQUIPPED = "Item Unequipped",
    ITEM_DROPPED = "Item Dropped",
    LORE_DISCOVERY = "Lore Uncovered",
    QUEST_UPDATE = "Quest Update",
    MISC_EVENT = "Miscellaneous Event",
    ACTION_DISCOVERED = "Past Action Discovered",
    HARVEST = "Harvest"
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
    worldMapCoordinates?: {
        x: number;
        y: number;
    };
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
export interface ShortRestTracker {
    restsTakenToday: number;
    lastRestDay: number;
    lastRestEndedAtMs: number | null;
}
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
    subMapCoordinates: {
        x: number;
        y: number;
    } | null;
    messages: GameMessage[];
    isLoading: boolean;
    loadingMessage: string | null;
    isImageLoading: boolean;
    error: string | null;
    worldSeed: number;
    mapData: MapData | null;
    isMapVisible: boolean;
    isSubmapVisible: boolean;
    isThreeDVisible?: boolean;
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
    banterDebugLog: {
        timestamp: Date;
        check: string;
        result: boolean | string;
        details?: string;
    }[];
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
    notifications: Notification[];
    factions: Record<string, Faction>;
    playerFactionStandings: Record<string, PlayerFactionStanding>;
    companions: Record<string, Companion>;
    religion: ReligionState;
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
    playerIdentity?: PlayerIdentityState;
    legacy?: PlayerLegacy;
    strongholds?: Record<string, Stronghold>;
    playerInvestments: import('./economy').PlayerInvestment[];
    pendingCouriers: import('./economy').PendingCourier[];
    businesses: Record<string, import('./business').BusinessState>;
    worldBusinesses: Record<string, import('./business').WorldBusiness>;
    underdark: UnderdarkState;
    environment?: import('./environment').WeatherState;
    isThievesGuildVisible: boolean;
    isThievesGuildSafehouseVisible?: boolean;
    naval: NavalState;
    isNavalDashboardVisible: boolean;
    isNobleHouseListVisible: boolean;
    isTradeRouteDashboardVisible: boolean;
    isEconomyLedgerVisible: boolean;
    isCourierPouchVisible: boolean;
    activeRitual?: RitualState | null;
    townState: import('./town').TownState | null;
    townEntryDirection: 'north' | 'east' | 'south' | 'west' | null;
    activeDialogueSession: import('./dialogue').DialogueSession | null;
    isDialogueInterfaceOpen: boolean;
    isLockpickingModalVisible: boolean;
    activeLock: import('../systems/puzzles/types').Lock | null;
    isDiceRollerVisible: boolean;
    visualDiceEnabled: boolean;
    isOllamaDependencyModalVisible: boolean;
    banterCooldowns: Record<string, number>;
    ship?: Ship;
    crafting?: CraftingState;
    journal?: JournalState;
    activeConversation?: import('./conversation').ActiveConversation | null;
    archivedBanters: import('./companions').BanterMoment[];
    shortRestTracker: ShortRestTracker;
}
