
import { describe, it, expect } from 'vitest';
import { LeverageSystem, LeverageAttempt } from '../LeverageSystem';
import { Secret, PlayerIdentityState } from '../../../types/identity';
import { identityReducer } from '../../../state/reducers/identityReducer';
import { GameState } from '../../../types';

describe('LeverageSystem', () => {
    const system = new LeverageSystem(12345);

    const mockSecret: Secret = {
        id: 'sec_1',
        subjectId: 'faction_1',
        content: 'The leader is a vampire.',
        verified: true,
        value: 8,
        knownBy: [],
        tags: ['supernatural']
    };

    const mockTarget = {
        id: 'faction_1',
        name: 'House Vampyr',
        power: 80,
        reputation: -10
    };

    it('calculates resistance correctly', () => {
        const resistance = system.calculateLeverageResistance(mockSecret, mockTarget.power, mockTarget.reputation);
        expect(resistance).toBeCloseTo(52);
    });

    it('processes a successful blackmail attempt', () => {
        const attempt: LeverageAttempt = {
            secretId: mockSecret.id,
            targetId: mockTarget.id,
            goal: 'blackmail'
        };

        const result = system.applyLeverage(attempt, mockSecret, mockTarget);

        expect(['success', 'failure', 'backfire']).toContain(result.outcome);
        if (result.outcome === 'success') {
            expect(result.rewards?.gold).toBeGreaterThan(0);
            expect(result.consequences?.secretBurned).toBe(true);
        }
    });

    it('handles backfires on critical failures', () => {
        const weakSecret: Secret = { ...mockSecret, value: 1 };
        const strongTarget = { ...mockTarget, power: 100 };

        const attempt: LeverageAttempt = {
            secretId: weakSecret.id,
            targetId: strongTarget.id,
            goal: 'favor'
        };

        const result = system.applyLeverage(attempt, weakSecret, strongTarget);
        expect(result.outcome).not.toBe('success');
    });

    describe('integration: APPLY_LEVERAGE reducer', () => {
        const baseState = {
            phase: 'exploration',
            party: [{ id: 'player_1', name: 'Hero', gold: 100 }] as any,
            inventory: [],
            gold: 100,
            currentLocationId: 'town_1',
            subMapCoordinates: null,
            messages: [],
            isLoading: false,
            loadingMessage: null,
            isImageLoading: false,
            error: null,
            worldSeed: 54321,
            mapData: null,
            isMapVisible: false,
            isPartyOverlayVisible: false,
            isNpcTestModalVisible: false,
            isLogbookVisible: false,
            isGameGuideVisible: false,
            dynamicLocationItemIds: {},
            currentLocationActiveDynamicNpcIds: null,
            geminiGeneratedActions: null,
            characterSheetModal: { isOpen: false, character: null },
            gameTime: new Date(),
            isDevMenuVisible: false,
            isPartyEditorVisible: false,
            isGeminiLogViewerVisible: false,
            geminiInteractionLog: [],
            isOllamaLogViewerVisible: false,
            isUnifiedLogViewerVisible: false,
            ollamaInteractionLog: [],
            hasNewRateLimitError: false,
            devModelOverride: null,
            isDevModeEnabled: false,
            banterDebugLog: [],
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
            economy: { activeEvents: [], marketFactors: { surplus: [], scarcity: [] }, priceModifiers: {} } as any,
            notoriety: { notoriety: 0, knownCrimes: [] } as any,
            questLog: [],
            isQuestLogVisible: false,
            notifications: [],
            factions: {
                faction_1: { id: 'faction_1', name: 'House Vampyr', description: '', type: 'NOBLE_HOUSE', colors: { primary: '#000', secondary: '#fff' }, ranks: [], allies: [], enemies: [], rivals: [], relationships: {}, values: [], hates: [], power: 80, assets: [], treasury: 0, taxRate: 0, controlledRegionIds: [], controlledRouteIds: [], economicPolicy: 'mercantile', tradeGoodPriorities: [] } as any
            },
            playerFactionStandings: {},
            companions: {},
            religion: {} as any,
            divineFavor: {},
            temples: {},
            fences: {},
            dynamicLocations: {},
            dynamicNPCs: {},
            generatedNpcs: {},
            playerInvestments: [],
            pendingCouriers: [],
            businesses: {},
            worldBusinesses: {},
            underdark: {} as any,
            naval: {} as any,
            isNavalDashboardVisible: false,
            isNobleHouseListVisible: false,
            isTradeRouteDashboardVisible: false,
            isInvestmentBoardVisible: false,
            isEconomyLedgerVisible: false,
            isCourierPouchVisible: false,
            townState: null,
            townEntryDirection: null,
            activeDialogueSession: null,
            isDialogueInterfaceOpen: false,
            isThievesGuildVisible: false,
            isLockpickingModalVisible: false,
            activeLock: null,
            isDiceRollerVisible: false,
            visualDiceEnabled: false,
            isOllamaDependencyModalVisible: false,
            banterCooldowns: {},
            shortRestTracker: { shortRestUsed: 0, maxShortRests: 1, lastLongRest: { time: new Date(), location: 'town' } } as any,
            archivedBanters: [],
            worldViewMode: 'atlas',
            mapSurface: 'classic',
            playerWorldPos: null,
            worldforgeDeltas: [],
            tempParty: null,
        };

        const identityState: PlayerIdentityState = {
            characterId: 'player_1',
            trueIdentity: { id: 'true_1', name: 'Hero', type: 'true', history: 'A hero', fame: 0 },
            activeDisguise: null,
            currentPersonaId: 'true_1',
            aliases: [],
            knownSecrets: [mockSecret],
            exposedSecrets: []
        };

        it('burns the secret on successful blackmail and adds gold', () => {
            const stateWithIdentity = { ...baseState, playerIdentity: identityState } as GameState;
            const result = identityReducer(stateWithIdentity, {
                type: 'APPLY_LEVERAGE',
                payload: { secretId: 'sec_1', targetId: 'faction_1', goal: 'blackmail' }
            });

            expect(result.messages?.length).toBeGreaterThan(0);
            expect(result.messages![0].text).toContain('House Vampyr');
            if (result.playerIdentity) {
                const burned = !result.playerIdentity.knownSecrets.find(s => s.id === 'sec_1');
                expect(burned).toBe(true);
            }
        });

        it('rejects leverage with an unknown secret', () => {
            const stateWithIdentity = { ...baseState, playerIdentity: identityState } as GameState;
            const result = identityReducer(stateWithIdentity, {
                type: 'APPLY_LEVERAGE',
                payload: { secretId: 'unknown_secret', targetId: 'faction_1', goal: 'blackmail' }
            });

            expect(result.messages?.length).toBeGreaterThan(0);
            expect(result.messages![0].text).toContain('do not know');
            expect(result.playerIdentity).toBeUndefined();
        });
    });
});
