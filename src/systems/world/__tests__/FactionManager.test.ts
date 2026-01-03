
import { describe, it, expect } from 'vitest';
import { FactionManager } from '../FactionManager';
// TODO(lint-intent): 'Faction' is unused in this test; use it in the assertion path or remove it.
import { GameState, GamePhase, Faction as _Faction } from '../../../types';
import { FACTIONS } from '../../../data/factions';

const mockState: GameState = {
    factions: JSON.parse(JSON.stringify(FACTIONS)),
    playerFactionStandings: {},
    gameTime: new Date(),
    activeRumors: [],
    // ... minimal other state
    phase: GamePhase.PLAYING,
    party: [],
    inventory: [],
    gold: 0,
    currentLocationId: 'loc1',
    messages: [],
    isLoading: false,
    loadingMessage: null,
    isImageLoading: false,
    error: null,
    worldSeed: 123,
    mapData: null,
    isMapVisible: false,
    isSubmapVisible: false,
    isPartyOverlayVisible: false,
    isNpcTestModalVisible: false,
    isLogbookVisible: false,
    isGameGuideVisible: false,
    dynamicLocationItemIds: {},
    currentLocationActiveDynamicNpcIds: null,
    geminiGeneratedActions: null,
    characterSheetModal: { isOpen: false, character: null },
    isDevMenuVisible: false,
    isPartyEditorVisible: false,
    isGeminiLogViewerVisible: false,
    geminiInteractionLog: [],
    hasNewRateLimitError: false,
    devModelOverride: null,
    isEncounterModalVisible: false,
    generatedEncounter: null,
    encounterSources: null,
    encounterError: null,
    currentEnemies: null,
    lastInteractedNpcId: null,
    lastNpcResponse: null,
    inspectedTileDescriptions: {},
    discoveryLog: [],
    unreadDiscoveryCount: 0,
    isDiscoveryLogVisible: false,
    isGlossaryVisible: false,
    npcMemory: {},
    locationResidues: {},
    metNpcIds: [],
    merchantModal: { isOpen: false, merchantName: '', merchantInventory: [] },
    economy: {
        activeEvents: [],
        marketFactors: { scarcity: [], surplus: [] },
        // TODO(lint-intent): 'prices' is not part of EconomyState; kept as legacy stub for assertions.
        prices: {}
    } as unknown as GameState['economy'],
    notoriety: { globalHeat: 0, localHeat: {}, knownCrimes: [], bounties: [] },
    questLog: [],
    isQuestLogVisible: false,
    notifications: [],
    companions: {},
    divineFavor: {},
    temples: {},
    fences: {},
    dynamicLocations: {},
    underdark: {
        currentDepth: 0,
        isDarkvisionActive: false,
        lightSources: [],
        // TODO(2026-01-03 Codex-CLI): Align test UnderdarkState with domain model once stabilized.
        sanity: { current: 100, max: 100, madnessLevel: 0 },
        activeEffects: []
    },
    environment: {
        currentWeather: 'clear' as any,
        temperature: 20 as any,
        windSpeed: 0,
        precipitation: 0 as any,
        isDaytime: true,
        lastWeatherUpdate: 0
    },
    townState: null,
    townEntryDirection: null,
    tempParty: null,
    subMapCoordinates: null
};

// Setup relationships for testing
// Iron Ledger <-> House Vane (Allies)
// Iron Ledger <-> Unseen Hand (Enemies)
mockState.factions['iron_ledger'].allies = ['house_vane'];
mockState.factions['iron_ledger'].enemies = ['unseen_hand'];
mockState.factions['house_vane'].allies = ['iron_ledger'];

describe('FactionManager', () => {
    it('applies direct reputation changes correctly', () => {
        const result = FactionManager.applyReputationChange(mockState, 'iron_ledger', 10, 'good deed');

        expect(result.standings['iron_ledger'].publicStanding).toBe(10);
        expect(result.logs.length).toBeGreaterThan(0);
        expect(result.logs[0].text).toContain('The Iron Ledger');
    });

    it('generates ripple effects for allies', () => {
        // Helping Iron Ledger should help House Vane (Ally)
        const result = FactionManager.applyReputationChange(mockState, 'iron_ledger', 20, 'big help');

        expect(result.standings['iron_ledger'].publicStanding).toBe(20);
        // Ally gets 50%
        expect(result.standings['house_vane'].publicStanding).toBe(10);
        expect(result.logs.find(l => l.text.includes('House Vane'))).toBeTruthy();
    });

    it('generates ripple effects for enemies', () => {
        // Helping Iron Ledger should hurt Unseen Hand (Enemy)
        const result = FactionManager.applyReputationChange(mockState, 'iron_ledger', 20, 'big help');

        // Enemy loses 50%
        expect(result.standings['unseen_hand'].publicStanding).toBe(-10);
    });

    it('generates rumors for significant changes', () => {
        const result = FactionManager.applyReputationChange(mockState, 'iron_ledger', 20, 'heroic feat');

        expect(result.rumors.length).toBe(1);
        expect(result.rumors[0].sourceFactionId).toBe('iron_ledger');
        expect(result.rumors[0].virality).toBeGreaterThan(0.5);
    });

    it('does not generate rumors for minor changes', () => {
        const result = FactionManager.applyReputationChange(mockState, 'iron_ledger', 5, 'small favor');

        expect(result.rumors.length).toBe(0);
    });
});
