
/**
 * @file src/state/appState.ts
 * Defines the state structure, initial state, actions, and the root reducer for the application.
 * The root reducer orchestrates calls to smaller "slice" reducers for better modularity.
 */
import { GameState, GamePhase, PlayerCharacter, Item, MapData, TempPartyMember, StartGameSuccessPayload, SuspicionLevel, KnownFact, QuestStatus, UnderdarkState } from '../types';
import { AppAction } from './actionTypes';
import { DEFAULT_WEATHER } from '../systems/environment/EnvironmentSystem';
import { STARTING_LOCATION_ID, DUMMY_PARTY_FOR_DEV, LOCATIONS, ITEMS, initialInventoryForDummyCharacter, CLASSES_DATA, NPCS } from '../constants';
import { FACTIONS, INITIAL_FACTION_STANDINGS } from '../data/factions';
import { getAllFactions } from '../utils/factionUtils';
import { DEITIES } from '../data/deities';
import { TEMPLES } from '../data/temples';
import { canUseDevTools } from '../utils/permissions';
import { SUBMAP_DIMENSIONS } from '../config/mapConfig';
import * as SaveLoadService from '../services/saveLoadService';
import { determineActiveDynamicNpcsForLocation } from '../utils/locationUtils';
import { applyXpAndHandleLevelUps, createPlayerCharacterFromTemp } from '../utils/characterUtils';
import { createEnemyFromMonster } from '../utils/combatUtils';
import { logger } from '../utils/logger';

// Import slice reducers
import { uiReducer } from './reducers/uiReducer';
import { religionReducer } from './reducers/religionReducer';
import { characterReducer } from './reducers/characterReducer';
import { worldReducer } from './reducers/worldReducer';
import { logReducer } from './reducers/logReducer';
import { encounterReducer } from './reducers/encounterReducer';
import { npcReducer } from './reducers/npcReducer';
import { questReducer } from './reducers/questReducer';
import { townReducer } from './reducers/townReducer';
import { crimeReducer } from './reducers/crimeReducer';
import { companionReducer } from './reducers/companionReducer';
import { ritualReducer } from './reducers/ritualReducer';
import { COMPANIONS } from '../constants';


// Helper function to create a date at 07:00 AM on an arbitrary fixed date
const createInitialGameTime = (): Date => {
    const initialTime = new Date(Date.UTC(351, 0, 1, 7, 0, 0, 0));
    return initialTime;
};

const INITIAL_UNDERDARK_STATE: UnderdarkState = {
    currentDepth: 0,
    lightLevel: 'bright', // Surface default
    activeLightSources: [],
    sanity: {
        current: 100,
        max: 100,
        madnessLevel: 0
    }
};

export const initialGameState: GameState = {
    phase: canUseDevTools() && DUMMY_PARTY_FOR_DEV && DUMMY_PARTY_FOR_DEV.length > 0 && !SaveLoadService.hasSaveGame() ? GamePhase.PLAYING : GamePhase.MAIN_MENU,
    party: canUseDevTools() && !SaveLoadService.hasSaveGame() ? DUMMY_PARTY_FOR_DEV : [],
    tempParty: canUseDevTools() && !SaveLoadService.hasSaveGame() ? DUMMY_PARTY_FOR_DEV.map(p => ({ id: p.id || crypto.randomUUID(), level: p.level || 1, classId: p.class.id })) : null,
    inventory: canUseDevTools() && !SaveLoadService.hasSaveGame() ? [...initialInventoryForDummyCharacter] : [],
    gold: 10, // Default starting gold
    currentLocationId: STARTING_LOCATION_ID,
    subMapCoordinates: canUseDevTools() && !SaveLoadService.hasSaveGame() ? { x: Math.floor(SUBMAP_DIMENSIONS.cols / 2), y: Math.floor(SUBMAP_DIMENSIONS.rows / 2) } : null,
    messages: [],
    isLoading: canUseDevTools() && !!DUMMY_PARTY_FOR_DEV && DUMMY_PARTY_FOR_DEV.length > 0 && !SaveLoadService.hasSaveGame(),
    loadingMessage: canUseDevTools() && !!DUMMY_PARTY_FOR_DEV && DUMMY_PARTY_FOR_DEV.length > 0 && !SaveLoadService.hasSaveGame() ? "Aralia is weaving fate..." : null,
    isImageLoading: false,
    error: null,
    worldSeed: Date.now(), // Default seed, will be overwritten on new game
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
    hasNewRateLimitError: false,
    devModelOverride: null,

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
    },

    // Ritualist: Ritual System
    activeRituals: {},

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
    divineFavor: DEITIES.reduce((acc, deity) => {
        acc[deity.id] = { deityId: deity.id, favor: 0, history: [] };
        return acc;
    }, {} as GameState['divineFavor']),
    temples: TEMPLES.reduce((acc, temple) => {
        acc[temple.id] = temple;
        return acc;
    }, {} as GameState['temples']),

    // Underdark System
    underdark: INITIAL_UNDERDARK_STATE,

    // Environment System
    environment: DEFAULT_WEATHER,
};


export function appReducer(state: GameState, action: AppAction): GameState {
    // 1. Handle actions with cross-cutting concerns first
    switch (action.type) {
        case 'SET_GAME_PHASE':
            let additionalUpdates: Partial<GameState> = {
                loadingMessage: null,
                previousPhase: state.phase !== action.payload ? state.phase : state.previousPhase, // Track previous phase
            };
            if (action.payload === GamePhase.MAIN_MENU || action.payload === GamePhase.CHARACTER_CREATION) {
                // Reset a wide range of UI and game context state when returning to menu or starting creation
                additionalUpdates = {
                    ...additionalUpdates,
                    geminiGeneratedActions: null,
                    isMapVisible: false,
                    isSubmapVisible: false,
                    error: null,
                    characterSheetModal: { isOpen: false, character: null },
                    lastInteractedNpcId: null,
                    lastNpcResponse: null,
                    currentLocationActiveDynamicNpcIds: null,
                    isDevMenuVisible: false,
                    isGeminiLogViewerVisible: false,
                    isDiscoveryLogVisible: false,
                    isGlossaryVisible: false,
                    selectedGlossaryTermForModal: undefined,
                    isPartyOverlayVisible: false,
                    isNpcTestModalVisible: false,
                    isLogbookVisible: false,
                    isGameGuideVisible: false,
                    merchantModal: { isOpen: false, merchantName: '', merchantInventory: [] },
                };
                if (action.payload === GamePhase.CHARACTER_CREATION) {
                    // Full reset for a new game
                    additionalUpdates = {
                        ...additionalUpdates,
                        gameTime: createInitialGameTime(),
                        discoveryLog: [],
                        unreadDiscoveryCount: 0,
                        inventory: [],
                        tempParty: null,
                        metNpcIds: [],
                        gold: 0,
                        questLog: [],
                    }
                }
            }
            return { ...state, phase: action.payload, ...additionalUpdates };

        case 'START_NEW_GAME_SETUP': {
            const allFactions = getAllFactions(action.payload.worldSeed);
            // Initialize standings for generated factions
            const factionStandings = { ...INITIAL_FACTION_STANDINGS };

            Object.values(allFactions).forEach(faction => {
                if (!factionStandings[faction.id]) {
                    factionStandings[faction.id] = {
                        factionId: faction.id,
                        publicStanding: 0,
                        secretStanding: 0,
                        rankId: 'outsider',
                        favorsOwed: 0,
                        renown: 0
                    };
                }
            });

            return {
                ...initialGameState,
                phase: GamePhase.CHARACTER_CREATION,
                worldSeed: action.payload.worldSeed,
                mapData: action.payload.mapData,
                dynamicLocationItemIds: action.payload.dynamicLocationItemIds,
                inventory: [],
                currentLocationActiveDynamicNpcIds: determineActiveDynamicNpcsForLocation(STARTING_LOCATION_ID, LOCATIONS),
                gameTime: createInitialGameTime(),
                isLoading: false,
                loadingMessage: null,
                gold: 0,
                questLog: [],
                notifications: [],
                factions: allFactions,
                playerFactionStandings: factionStandings
            };
        }

        case 'START_GAME_FOR_DUMMY': {
            const { mapData, dynamicLocationItemIds, generatedParty, worldSeed } = action.payload;
            if (!generatedParty || generatedParty.length === 0) return { ...state, error: "Dummy character data not available.", phase: GamePhase.MAIN_MENU, isLoading: false, loadingMessage: null };
            const initialDummyLocation = LOCATIONS[STARTING_LOCATION_ID];

            const allFactions = getAllFactions(worldSeed);
            const factionStandings = { ...INITIAL_FACTION_STANDINGS };

            Object.values(allFactions).forEach(faction => {
                if (!factionStandings[faction.id]) {
                     factionStandings[faction.id] = {
                        factionId: faction.id,
                        publicStanding: 0,
                        secretStanding: 0,
                        rankId: 'outsider',
                        favorsOwed: 0,
                        renown: 0
                    };
                }
            });

            return {
                ...initialGameState,
                phase: GamePhase.PLAYING,
                worldSeed: worldSeed,
                party: generatedParty,
                tempParty: generatedParty.map(p => ({ id: p.id || crypto.randomUUID(), level: p.level || 1, classId: p.class.id })),
                inventory: [...initialInventoryForDummyCharacter],
                gold: 100, // Dummy gets some spending money
                currentLocationId: STARTING_LOCATION_ID,
                subMapCoordinates: { x: Math.floor(SUBMAP_DIMENSIONS.cols / 2), y: Math.floor(SUBMAP_DIMENSIONS.rows / 2) },
                messages: [
                    { id: Date.now(), text: `Welcome, ${generatedParty[0].name} and party! Your adventure begins (Dev Mode).`, sender: 'system', timestamp: new Date() },
                    { id: Date.now() + 1, text: initialDummyLocation.baseDescription, sender: 'system', timestamp: new Date() }
                ],
                mapData: mapData,
                dynamicLocationItemIds: dynamicLocationItemIds,
                currentLocationActiveDynamicNpcIds: determineActiveDynamicNpcsForLocation(STARTING_LOCATION_ID, LOCATIONS),
                isLoading: false,
                loadingMessage: null,
                questLog: [],
                isQuestLogVisible: false,
                notifications: [],
                factions: allFactions,
                playerFactionStandings: factionStandings
            };
        }

        case 'START_GAME_SUCCESS': {
            const { startingInventory, ...restOfPayload } = action.payload;
            // Convert any legacy coin items in starting inventory to gold value
            let startingGold = 10; // Base starting gold
            const filteredInventory = startingInventory.filter(item => {
                if (item.id === 'shiny_coin') {
                    startingGold += 1;
                    return false;
                }
                return true;
            });

            return {
                ...initialGameState,
                phase: GamePhase.PLAYING,
                worldSeed: state.worldSeed, // Carry over the seed from the new game setup
                party: [{ ...restOfPayload.character, equippedItems: restOfPayload.character.equippedItems || {} }],
                inventory: filteredInventory,
                gold: startingGold,
                messages: [
                    { id: Date.now() + Math.random(), text: `Welcome, ${restOfPayload.character.name} the ${restOfPayload.character.race.name} ${restOfPayload.character.class.name}! Your adventure begins.`, sender: 'system', timestamp: new Date() },
                    { id: Date.now() + Math.random() + 1, text: restOfPayload.initialLocationDescription, sender: 'system', timestamp: new Date() }
                ],
                currentLocationId: STARTING_LOCATION_ID,
                subMapCoordinates: restOfPayload.initialSubMapCoordinates,
                mapData: restOfPayload.mapData,
                dynamicLocationItemIds: restOfPayload.dynamicLocationItemIds,
                currentLocationActiveDynamicNpcIds: restOfPayload.initialActiveDynamicNpcIds,
                isLoading: false,
                loadingMessage: null,
                questLog: [],
                isQuestLogVisible: false,
                notifications: [],
                // Ensure factions from state are preserved (set in START_NEW_GAME_SETUP)
                factions: state.factions,
                playerFactionStandings: state.playerFactionStandings
            };
        }

        case 'LOAD_GAME_SUCCESS': {
            const loadedState = action.payload;
            const gameTimeFromLoad = typeof loadedState.gameTime === 'string' ? new Date(loadedState.gameTime) : loadedState.gameTime;
            const partyFromLoad = (loadedState.party && loadedState.party.length > 0) ? loadedState.party : (((loadedState as any).playerCharacter) ? [(loadedState as any).playerCharacter] : []);

            for (const npcId in loadedState.npcMemory) {
                const memory = loadedState.npcMemory[npcId];
                if (memory.knownFacts.length > 0 && typeof memory.knownFacts[0] === 'string') {
                    logger.info('Migrating knownFacts for NPC', { npcId });
                    const oldStringFacts = memory.knownFacts as unknown as string[];
                    memory.knownFacts = oldStringFacts.map((factText): KnownFact => ({
                        id: crypto.randomUUID(),
                        text: factText,
                        source: 'direct',
                        isPublic: true,
                        timestamp: gameTimeFromLoad.getTime(),
                        strength: 5,
                        lifespan: 999,
                    }));
                }
            }

            // Migrate old shiny_coin items to gold property
            let migratedGold = loadedState.gold !== undefined ? loadedState.gold : 0;
            let migratedInventory = loadedState.inventory || [];
            if (migratedInventory.some(item => item.id.startsWith('shiny_coin'))) {
                const coinCount = migratedInventory.filter(item => item.id.startsWith('shiny_coin')).length;
                migratedGold += coinCount;
                migratedInventory = migratedInventory.filter(item => !item.id.startsWith('shiny_coin'));
                logger.info('Migrated shiny_coin items to gold', { coinCount, totalGold: migratedGold });
            }

            // Load factions from state, falling back to getAllFactions if missing (legacy save support)
            const loadedFactions = loadedState.factions || getAllFactions(loadedState.worldSeed || Date.now());
            const loadedStandings = loadedState.playerFactionStandings || INITIAL_FACTION_STANDINGS;

            return {
                ...loadedState,
                phase: GamePhase.LOAD_TRANSITION,
                isLoading: false, loadingMessage: null, isImageLoading: false, error: null,
                isMapVisible: false, isSubmapVisible: false, isDevMenuVisible: false, isPartyEditorVisible: false,
                isPartyOverlayVisible: false, isGeminiLogViewerVisible: false, isDiscoveryLogVisible: false,
                isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isLogbookVisible: false,
                isGameGuideVisible: false,
                geminiGeneratedActions: null,
                party: partyFromLoad.map(p => ({ ...(p as PlayerCharacter), equippedItems: (p as PlayerCharacter).equippedItems || {} })),
                inventory: migratedInventory,
                gold: migratedGold,
                currentLocationActiveDynamicNpcIds: determineActiveDynamicNpcsForLocation(loadedState.currentLocationId, LOCATIONS),
                characterSheetModal: loadedState.characterSheetModal || { isOpen: false, character: null },
                gameTime: gameTimeFromLoad,
                geminiInteractionLog: loadedState.geminiInteractionLog || [],
                inspectedTileDescriptions: loadedState.inspectedTileDescriptions || {},
                discoveryLog: loadedState.discoveryLog || [],
                unreadDiscoveryCount: loadedState.unreadDiscoveryCount || 0,
                metNpcIds: loadedState.metNpcIds || [],
                locationResidues: loadedState.locationResidues || {},
                merchantModal: { isOpen: false, merchantName: '', merchantInventory: [] },
                questLog: loadedState.questLog || [],
                isQuestLogVisible: false,
                notoriety: loadedState.notoriety || { globalHeat: 0, localHeat: {}, knownCrimes: [] },
                notifications: [],
                // Use loaded or fallback
                factions: loadedFactions,
                playerFactionStandings: loadedStandings,
                underdark: loadedState.underdark || INITIAL_UNDERDARK_STATE
            };
        }

        case 'MOVE_PLAYER': {
            return {
                ...state,
                currentLocationId: action.payload.newLocationId,
                subMapCoordinates: action.payload.newSubMapCoordinates,
                mapData: action.payload.mapData || state.mapData,
                currentLocationActiveDynamicNpcIds: action.payload.activeDynamicNpcIds,
                geminiGeneratedActions: null,
                lastInteractedNpcId: null,
                lastNpcResponse: null,
                merchantModal: { isOpen: false, merchantName: '', merchantInventory: [] },
            };
        }

        case 'INITIALIZE_DUMMY_PLAYER_STATE':
            return {
                ...state,
                messages: [
                    { id: Date.now() + Math.random(), text: `Welcome, ${state.party[0]!.name} and party! Your adventure begins (Dev Mode - Auto Start).`, sender: 'system', timestamp: new Date() },
                    { id: Date.now() + Math.random() + 1, text: action.payload.initialLocationDescription, sender: 'system', timestamp: new Date() }
                ],
                subMapCoordinates: action.payload.initialSubMapCoordinates,
                isLoading: false, loadingMessage: null, isImageLoading: false,
                mapData: action.payload.mapData,
                isSubmapVisible: false,
                dynamicLocationItemIds: action.payload.dynamicLocationItemIds,
                inventory: [...initialInventoryForDummyCharacter],
                gold: 100,
                currentLocationActiveDynamicNpcIds: action.payload.initialActiveDynamicNpcIds,
                gameTime: createInitialGameTime(),
                questLog: [],
                isQuestLogVisible: false,
                notifications: [],
            };

        case 'APPLY_TAKE_ITEM_UPDATE': {
            const { item, locationId, discoveryEntry } = action.payload;

            const dynamicItems = { ...state.dynamicLocationItemIds };
            // Safely remove item from location if it exists in the map
            if (dynamicItems[locationId]) {
                dynamicItems[locationId] = dynamicItems[locationId].filter(id => id !== item.id);
            }

            return {
                ...state,
                inventory: [...state.inventory, item],
                dynamicLocationItemIds: dynamicItems,
                discoveryLog: [discoveryEntry, ...state.discoveryLog],
                unreadDiscoveryCount: state.unreadDiscoveryCount + 1,
                geminiGeneratedActions: null,
                lastInteractedNpcId: null,
                lastNpcResponse: null,
            };
        }

        case 'SETUP_BATTLE_MAP_DEMO': {
            const playerParty = state.party;
            if (!playerParty || playerParty.length === 0) {
                return { ...state, error: "Cannot start battle demo without a party. Please start or load a game first." };
            }
            return {
                ...state,
                phase: GamePhase.BATTLE_MAP_DEMO,
                isMapVisible: false, isSubmapVisible: false, isDiscoveryLogVisible: false, isGlossaryVisible: false, merchantModal: { isOpen: false, merchantName: '', merchantInventory: [] }
            };
        }

        case 'START_BATTLE_MAP_ENCOUNTER': {
            const combatants = action.payload.monsters.flatMap((monster, monsterIndex) =>
                Array.from({ length: monster.quantity }, (_, i) => createEnemyFromMonster(monster, i))
            );
            return {
                ...state,
                phase: GamePhase.COMBAT, // Now transitions to the actual combat phase
                currentEnemies: combatants,
                isEncounterModalVisible: false,
                isMapVisible: false, isSubmapVisible: false, isDiscoveryLogVisible: false, isGlossaryVisible: false, merchantModal: { isOpen: false, merchantName: '', merchantInventory: [] }
            };
        }

        case 'END_BATTLE': {
            const rewards = action.payload?.rewards;
            let newState = {
                ...state,
                phase: GamePhase.PLAYING,
                currentEnemies: null,
            };

            if (rewards && typeof rewards.xp === 'number') {
                // Distribute XP evenly to all party members and process any resulting level ups.
                const updatedParty = state.party.map((member) =>
                    applyXpAndHandleLevelUps(member, rewards.xp / state.party.length)
                );

                // Capture celebratory messages for characters who leveled up.
                const levelUpMessages = updatedParty
                    .filter((member, index) => member.level > (state.party[index]?.level || 0))
                    .map((member, index) => ({
                        id: Date.now() + index + 1,
                        text: `${member.name} reached level ${member.level}!`,
                        sender: 'system',
                        timestamp: new Date()
                    }));

                const itemsFoundMessage = rewards.items.length > 0
                    ? `You found: ${rewards.items.map(i => i.name).join(', ')}.`
                    : 'You found no items.';

                newState = {
                    ...newState,
                    party: updatedParty,
                    gold: newState.gold + (rewards.gold || 0),
                    inventory: [...newState.inventory, ...(rewards.items || [])],
                    messages: [
                        ...newState.messages,
                        {
                            id: Date.now(),
                            text: `Victory! The party gained ${rewards.xp} XP and ${rewards.gold || 0} gold. ${itemsFoundMessage}`,
                            sender: 'system',
                            timestamp: new Date()
                        },
                        ...levelUpMessages,
                    ]
                };
            } else {
                newState.messages.push({
                    id: Date.now(),
                    text: `The battle ends.`,
                    sender: 'system',
                    timestamp: new Date()
                });
            }
            return newState;
        }

        // 2. Delegate to slice reducers for single-domain actions
        default: {
            const changes = {
                ...uiReducer(state, action),
                ...religionReducer(state, action),
                ...characterReducer(state, action),
                ...worldReducer(state, action),
                ...logReducer(state, action),
                ...encounterReducer(state, action),
                ...npcReducer(state, action),
                ...questReducer(state, action),
                ...townReducer(state, action),
                ...crimeReducer(state, action),
                ...companionReducer(state, action),
                ...ritualReducer(state, action),
            };

            if (Object.keys(changes).length === 0) {
                return state;
            }

            return {
                ...state,
                ...changes,
            };
        }
    }
}
