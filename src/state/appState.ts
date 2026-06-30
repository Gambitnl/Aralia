// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/06/2026, 01:52:47
 * Dependents: App.tsx
 * Imports: 43 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/state/appState.ts
 * Defines the state structure, initial state, actions, and the root reducer for the application.
 * The root reducer orchestrates calls to smaller "slice" reducers for better modularity.
 */
// TODO(lint-intent): 'Item' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { GameState, GamePhase, PlayerCharacter, Item as _Item, MapData as _MapData, TempPartyMember as _TempPartyMember, StartGameSuccessPayload as _StartGameSuccessPayload, SuspicionLevel, KnownFact, QuestStatus as _QuestStatus, UnderdarkState, Companion, CompanionReactionRule, Relationship } from '../types';
import { CompanionSoul } from '../types/companion';
import type { DivineFavor, NavalState } from '../types';
import { AppAction } from './actionTypes';
import { DEFAULT_WEATHER } from '../systems/environment/EnvironmentSystem';
import { STARTING_LOCATION_ID, LOCATIONS } from '../data/world/locations';
import { NPCS } from '../data/world/npcs';
import { COMPANIONS } from '../data/companions';
import { FACTIONS, INITIAL_FACTION_STANDINGS } from '../data/factions';
import { getAllFactions } from '../utils/factionUtils';
import { DEITIES } from '../data/deities';
import { TEMPLES } from '../data/temples';
import { canUseDevTools } from '../utils/permissions';
import { SUBMAP_DIMENSIONS, MAP_GRID_SIZE } from '../config/mapConfig';
import { derivePlayerCellForTile } from '../systems/worldforge/local/playerCellFromLegacy';
import { locationIdToTile } from '../utils/locationUtils';
import type { PlayerCell } from '../types/state';
import { getGameDay, inGameTimestamp } from '../utils/core';
import { gridWorldDimensions } from '../utils/worldCoords';
import * as SaveLoadService from '../services/saveLoadService';
import { determineActiveDynamicNpcsForLocation } from '@/utils/spatial';
// TODO(lint-intent): 'createPlayerCharacterFromTemp' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { applyXpAndHandleLevelUps, canLevelUp, createPlayerCharacterFromTemp as _createPlayerCharacterFromTemp } from '../utils/characterUtils';
import { logger } from '../utils/logger';
import { INITIAL_TRADE_ROUTES } from '../data/tradeRoutes';
import { createEmptyHistory } from '../utils/historyUtils';
import { generateId } from '../utils/core/idGenerator';

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
import { identityReducer } from './reducers/identityReducer';
import { dialogueReducer } from './reducers/dialogueReducer';
import { craftingReducer } from './reducers/craftingReducer';
import { conversationReducer } from './reducers/conversationReducer';
import { journalReducer } from './reducers/journalReducer';
import { legacyReducer } from './reducers/legacyReducer';
import { economyReducer } from './reducers/economyReducer';
import { gameEntryReducer } from './reducers/gameEntryReducer';
import { navalReducer } from './reducers/navalReducer';


// Helper function to create a date at 07:00 AM on an arbitrary fixed date
const createInitialGameTime = (): Date => {
    const initialTime = new Date(Date.UTC(351, 0, 1, 7, 0, 0, 0));
    return initialTime;
};

// Cache the initial time so we can align related default fields (like rest tracking).
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
};

import { initialGameState, INITIAL_DIVINE_FAVOR } from './initialState';
export { initialGameState, INITIAL_DIVINE_FAVOR };

/**
 * Derive the canonical player cell (cell-native world, Stage 2) from a legacy
 * location id + Locale-local position. The cell is a faithful shadow of the tile
 * the game already computes (via the existing golden reverse mapping); returns
 * null when it can't be resolved (e.g. the static 'clearing' node before spawn
 * relocation, or a generator hiccup) so the reducer never throws. Readers still
 * use the derived legacy fields this stage.
 *
 * GRID-RETIRE: BA-5 — dual `localeCoords` producer. This is the LEGACY tile path:
 * it writes `localeCoords` from the integer submap sub-tile (`subMapCoordinates`).
 * The ground path (`worldReducer` `SET_PLAYER_GROUND_POS`) writes continuous Locale
 * feet and wins whenever a ground/Locale session is active. Both producers survive
 * until Stage 6 deletes `subMapCoordinates` / this integer path, leaving feet sole.
 */
function derivePlayerCell(
  worldSeed: number,
  locationId: string,
  localeCoords: { x: number; y: number } | null,
  mapData: _MapData | null,
): PlayerCell | null {
  const tile = locationIdToTile(locationId, LOCATIONS);
  if (!tile) return null;
  const gridSize = mapData?.gridSize ?? MAP_GRID_SIZE;
  return derivePlayerCellForTile(worldSeed, tile, localeCoords, {
    cols: gridSize.cols,
    rows: gridSize.rows,
  });
}

// RALPH: The Root Brain.
// Orchestrates the "Big Bang" of state updates.
// 1. Cross-Cutting Concerns: Handles actions that affect multiple systems (e.g. SET_GAME_PHASE, START_BATTLE).
// 2. Delegation: Forwards single-domain actions to specialized slice reducers.
export function appReducer(state: GameState, action: AppAction): GameState {
    // 1. Handle actions with cross-cutting concerns first
    switch (action.type) {
        case 'SET_AUTO_SAVE_ENABLED': {
            return { ...state, autoSaveEnabled: action.payload };
        }
        case 'SET_WORLD_SEED': {
            // Reset naval.knownPorts so a mid-session seed change repopulates for
            // the new world (useKnownPortsSync re-fires when knownPorts is empty).
            return { ...state, worldSeed: action.payload, naval: { ...state.naval, knownPorts: [] } };
        }
        case 'SET_GAME_PHASE': {
            // TODO(lint-intent): This switch case declares new bindings, implying scoped multi-step logic.
            // TODO(lint-intent): Wrap the case in braces or extract a helper to keep scope and intent clear.
            // TODO(lint-intent): If shared state is intended, lift the declarations outside the switch.
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
                    isThievesGuildVisible: false,
                    merchantModal: { isOpen: false, merchantName: '', merchantInventory: [] },
                    isDialogueInterfaceOpen: false,
                    activeDialogueSession: null,
                    activeConversation: null,
                };
                if (action.payload === GamePhase.CHARACTER_CREATION) {
                    // Full reset for a new game
                    const resetGameTime = createInitialGameTime();
                    additionalUpdates = {
                        ...additionalUpdates,
                        gameTime: resetGameTime,
                        // Reset short rest pacing alongside the fresh in-game clock.
                        shortRestTracker: {
                            restsTakenToday: 0,
                            lastRestDay: getGameDay(resetGameTime),
                            lastRestEndedAtMs: null,
                        },
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
        }

        case 'ABANDON_RUN': {
            return {
                ...initialGameState,
                phase: GamePhase.MAIN_MENU,
                autoSaveEnabled: state.autoSaveEnabled ?? initialGameState.autoSaveEnabled,
                worldSeed: state.worldSeed,
                mapData: state.mapData,
                // Always clear run-specific state regardless of how initialGameState was evaluated
                party: [],
                tempParty: null,
                messages: [],
                isLoading: false,
                loadingMessage: null,
                inventory: [],
            };
        }

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
                        renown: 0,
                        // TODO(2026-01-03 pass 4 Codex-CLI): history stubbed to satisfy PlayerFactionStanding; populate with real events when factions log changes.
                        history: [],
                    };
                }
            });

            return {
                ...initialGameState,
                phase: GamePhase.CHARACTER_CREATION,
                worldSeed: action.payload.worldSeed,
                // Preserve user preference across new-game resets.
                autoSaveEnabled: state.autoSaveEnabled ?? initialGameState.autoSaveEnabled,
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
                playerFactionStandings: factionStandings,
                dynamicLocations: {},
            };
        }

        case 'RESTART_WITH_PROCEDURAL_PARTY': {
            const newParty = action.payload;
            if (!newParty || newParty.length === 0) {
                return { ...state, error: "Failed to generate procedural party." };
            }

            // Helper to generate reactions based on style
            const getReactionRulesForStyle = (style: string): CompanionReactionRule[] => {
                // Basic templates for now - can be expanded
                const baseRules: CompanionReactionRule[] = [
                    {
                        triggerType: 'combat_end',
                        triggerTags: ['victory'],
                        approvalChange: 1,
                        dialoguePool: ["We survive another day.", "Good fight.", "Victory is ours."]
                    }
                ];

                if (style === 'cynical') {
                    baseRules.push({
                        triggerType: 'decision',
                        triggerTags: ['charity'],
                        approvalChange: -1,
                        dialoguePool: ["Wasting resources...", "They won't thank you."]
                    });
                    baseRules.push({
                        triggerType: 'loot',
                        triggerTags: ['gold'],
                        approvalChange: 1,
                        dialoguePool: ["Now that's what I'm talking about.", "Shiny."]
                    });
                } else if (style === 'hopeful' || style === 'idealistic') {
                    baseRules.push({
                        triggerType: 'decision',
                        triggerTags: ['charity', 'kindness'],
                        approvalChange: 2,
                        dialoguePool: ["That was kind of you.", "The world needs more of that."]
                    });
                } else if (style === 'aggressive') {
                    baseRules.push({
                        triggerType: 'combat_hit',
                        triggerTags: ['crit'],
                        approvalChange: 1,
                        dialoguePool: ["Crushed them!", "Stay down!"]
                    });
                }

                return baseRules;
            };

            const createInitialRelationship = (targetId: string = 'player'): Relationship => ({
                targetId,
                level: 'stranger',
                approval: 0,
                history: [],
                unlocks: [],
            });

            // Convert PlayerCharacters with Souls into Companions
            const newCompanions: Record<string, Companion> = {};

            newParty.forEach(pc => {
                if (pc.soul && pc.id) {
                    const soul = pc.soul as CompanionSoul;
                    newCompanions[pc.id] = {
                        id: pc.id,
                        identity: {
                            id: pc.id,
                            name: pc.name,
                            race: pc.race.name,
                            class: pc.class.name,
                            background: pc.background || 'Unknown',
                            sex: pc.visuals?.gender || 'Unknown',
                            age: pc.age || 'Unknown',
                            physicalDescription: soul.physicalDescription,
                            avatarUrl: pc.portraitUrl
                        },
                        personality: {
                            openness: 50, // Default mid-values for Big 5 if not in soul
                            conscientiousness: 50,
                            extraversion: 50,
                            agreeableness: 50,
                            neuroticism: 50,
                            values: soul.personality.values,
                            fears: soul.personality.fears,
                            quirks: soul.personality.quirks
                        },
                        goals: soul.goals.map((g, idx) => ({
                            id: `goal_${pc.id}_${idx}`,
                            description: g.description,
                            isSecret: g.isSecret,
                            status: 'active',
                            progress: 0
                        })),
                        relationships: {
                            player: createInitialRelationship()
                        },
                        loyalty: 50,
                        approvalHistory: [],
                        memories: [],
                        discoveredFacts: [],
                        reactionRules: getReactionRulesForStyle(soul.reactionStyle),
                        progression: []
                    };
                }
            });

            // If we generated valid companions, use them. Otherwise fallback to existing (shouldn't happen with valid soul)
            const finalCompanions = Object.keys(newCompanions).length > 0 ? newCompanions : state.companions;

            const initialLocation = LOCATIONS[STARTING_LOCATION_ID];

            // Reset NPC memory for a fresh start
            const freshNpcMemory = Object.keys(NPCS).reduce((acc, npcId) => {
                const npcData = NPCS[npcId];
                acc[npcId] = {
                    disposition: 0,
                    knownFacts: [],
                    suspicion: SuspicionLevel.Unaware,
                    goals: npcData?.goals ? [...npcData.goals] : [],
                };
                return acc;
            }, {} as GameState['npcMemory']);

            return {
                ...initialGameState,
                phase: GamePhase.PLAYING,
                // Preserve user preference across resets.
                autoSaveEnabled: state.autoSaveEnabled ?? initialGameState.autoSaveEnabled,
                worldSeed: state.worldSeed,
                party: newParty,
                tempParty: newParty.map(p => ({ id: p.id || generateId(), name: p.name, level: p.level || 1, classId: p.class.id })),
                inventory: [],
                gold: 50,
                currentLocationId: STARTING_LOCATION_ID,
                subMapCoordinates: { x: Math.floor(SUBMAP_DIMENSIONS.cols / 2), y: Math.floor(SUBMAP_DIMENSIONS.rows / 2) },
                messages: [
                    { id: Date.now(), text: `A new party of adventurers emerges!`, sender: 'system', timestamp: new Date(initialGameState.gameTime.getTime()) },
                    { id: Date.now() + 1, text: initialLocation.baseDescription, sender: 'system', timestamp: new Date(initialGameState.gameTime.getTime()) }
                ],
                mapData: state.mapData,
                dynamicLocationItemIds: state.dynamicLocationItemIds,
                currentLocationActiveDynamicNpcIds: determineActiveDynamicNpcsForLocation(STARTING_LOCATION_ID, LOCATIONS),
                isLoading: false,
                loadingMessage: null,
                // CRITICAL: Update companions state
                companions: finalCompanions,
                // Reset history
                banterDebugLog: [],
                archivedBanters: [],
                npcMemory: freshNpcMemory,
                // Reset cooldowns
                banterCooldowns: {}
            };
        }

        case 'START_GAME_FOR_DUMMY': {
            const { mapData, dynamicLocationItemIds, generatedParty, worldSeed, worldHistory } = action.payload;
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
                        renown: 0,
                        // TODO(2026-01-03 pass 4 Codex-CLI): history stubbed to satisfy PlayerFactionStanding; populate with real events when factions log changes.
                        history: [],
                    };
                }
            });

            return {
                ...initialGameState,
                phase: GamePhase.PLAYING,
                // Preserve user preference across resets.
                autoSaveEnabled: state.autoSaveEnabled ?? initialGameState.autoSaveEnabled,
                worldSeed: worldSeed,
                party: generatedParty,
                tempParty: generatedParty.map(p => ({ id: p.id || generateId(), name: p.name, level: p.level || 1, classId: p.class.id })),
                inventory: [...action.payload.initialInventory],
                gold: 100, // Dummy gets some spending money
                currentLocationId: STARTING_LOCATION_ID,
                subMapCoordinates: { x: Math.floor(SUBMAP_DIMENSIONS.cols / 2), y: Math.floor(SUBMAP_DIMENSIONS.rows / 2) },
                messages: [
                    { id: Date.now(), text: `Welcome, ${generatedParty[0].name} and party! Your adventure begins (Dev Mode).`, sender: 'system', timestamp: new Date(initialGameState.gameTime.getTime()) },
                    { id: Date.now() + 1, text: initialDummyLocation.baseDescription, sender: 'system', timestamp: new Date(initialGameState.gameTime.getTime()) }
                ],
                mapData: mapData,
                dynamicLocationItemIds: dynamicLocationItemIds,
                // Preserve the generated founding story so the first save after
                // bootstrap already carries a world-history payload.
                worldHistory: worldHistory ?? createEmptyHistory(),
                currentLocationActiveDynamicNpcIds: determineActiveDynamicNpcsForLocation(STARTING_LOCATION_ID, LOCATIONS),
                isLoading: false,
                loadingMessage: null,
                questLog: [],
                isQuestLogVisible: false,
                notifications: [],
                factions: allFactions,
                playerFactionStandings: factionStandings,
                dynamicLocations: {},
                // Grant a mock ship for dev testing
                // TODO: Refactor to usage of MOCK_SHIP_SLOOP from src/data/dev/mockShips.ts
                // Duplicate mock data definition. Should use the recently created centralized mock object to ensure consistency between Dev Mode auto-injection and "Dummy Game" start.
                naval: {
                    playerShips: [{
                        id: 'mock_ship_1',
                        name: 'The Rusty Tub',
                        type: 'Sloop',
                        size: 'Small',
                        description: 'A weathered but reliable sloop.',
                        stats: {
                            hullPoints: 100,
                            maxHullPoints: 100,
                            speed: 40,
                            maneuverability: 60,
                            armorClass: 12,
                            cargoCapacity: 50,
                            crewMin: 2,
                            crewMax: 10
                        },
                        cargo: {
                            items: [],
                            totalWeight: 0,
                            capacityUsed: 0,
                            supplies: { food: 10, water: 10 }
                        },
                        crew: {
                            members: [],
                            averageMorale: 80,
                            unrest: 0,
                            quality: 'Average'
                        },
                        modifications: [],
                        weapons: [],
                        flags: {}
                    }],
                    activeShipId: 'mock_ship_1',
                    currentVoyage: null,
                    knownPorts: []
                }
            };
        }

        case 'START_GAME_SUCCESS': {
            const { startingInventory, ...restOfPayload } = action.payload;
            const worldHistory = action.payload.worldHistory ?? createEmptyHistory();
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
                // Preserve user preference across resets.
                autoSaveEnabled: state.autoSaveEnabled ?? initialGameState.autoSaveEnabled,
                // Prefer the seed the world was actually generated with (carried
                // in the payload); fall back to the seed set during new-game setup.
                worldSeed: restOfPayload.worldSeed ?? state.worldSeed,
                party: [{ ...restOfPayload.character, equippedItems: restOfPayload.character.equippedItems || {} }],
                inventory: filteredInventory,
                gold: startingGold,
                // The opening-situation conversation (triggered by the
                // BEGIN_OPENING_SITUATION dispatched right after this) is the entry
                // narrative now — it REPLACES the static "you are in a clearing"
                // spawn text. Seeding the legacy welcome + initialLocationDescription
                // here produced a second, contradictory narration in the log (the
                // game-entry brief calls for the player to no longer spawn into the
                // static description). START_GAME_SUCCESS is exclusively the real
                // new-game path, so the conversation always follows; dummy/auto-start
                // and load flows keep their own seeded messages elsewhere.
                messages: [],
                // Spawn the player at the WF-derived tile they actually occupy
                // (the relocated world marker), not the disconnected legacy
                // 'clearing'. Dev/skip flows omit it and keep the legacy node.
                currentLocationId: restOfPayload.initialLocationId ?? STARTING_LOCATION_ID,
                startTownName: restOfPayload.startTownName,
                startTownRegion: restOfPayload.startTownRegion,
                // Cell-native 3D entry anchor (set atomically with the spawn).
                entry3DAnchor: restOfPayload.entry3DAnchor ?? null,
                // Open the new game directly in the 3D world so the opening
                // situation is staged in-world (the player + the situation
                // strangers stand at the spawn — see SceneCast). The ground
                // loader engages via entry3DAnchor; the opening conversation
                // overlays the 3D scene. Dev/skip/load flows keep their own
                // view mode (they don't go through START_GAME_SUCCESS).
                worldViewMode: '3d',
                // Canonical player presence (cell-native world, Stage 2): the
                // start-selection spawn threads the chosen cell explicitly so the
                // source of truth agrees with entry3DAnchor; dev/skip flows derive
                // it from the resolved spawn tile (null if it's the static start).
                playerCell: restOfPayload.playerCell ?? derivePlayerCell(
                    restOfPayload.worldSeed ?? state.worldSeed,
                    restOfPayload.initialLocationId ?? STARTING_LOCATION_ID,
                    restOfPayload.initialSubMapCoordinates,
                    restOfPayload.mapData,
                ),
                subMapCoordinates: restOfPayload.initialSubMapCoordinates,
                mapData: restOfPayload.mapData,
                dynamicLocationItemIds: restOfPayload.dynamicLocationItemIds,
                // Standard starts use the same bridge; if a caller omits the
                // seeded history, we still land on an explicit empty registry.
                worldHistory,
                currentLocationActiveDynamicNpcIds: restOfPayload.initialActiveDynamicNpcIds,
                isLoading: false,
                loadingMessage: null,
                questLog: [],
                isQuestLogVisible: false,
                notifications: [],
                // Ensure factions from state are preserved (set in START_NEW_GAME_SETUP)
                factions: state.factions,
                playerFactionStandings: state.playerFactionStandings,
                dynamicLocations: {},
            };
        }

        case 'LOAD_GAME_SUCCESS': {
            // Heartkeeper: Clear active banter queues when loading a new game state to prevent "ghost" dialogue.
            import('../services/BanterDisplayService').then(({ BanterDisplayService }) => {
                BanterDisplayService.cancelActiveBanter();
            });

            const loadedState = action.payload as GameState & { playerCharacter?: PlayerCharacter };
            const gameTimeFromLoad = loadedState.gameTime
                ? (typeof loadedState.gameTime === 'string' ? new Date(loadedState.gameTime) : loadedState.gameTime)
                : new Date();
            const resolvedShortRestTracker = {
                restsTakenToday: loadedState.shortRestTracker?.restsTakenToday ?? 0,
                lastRestDay: loadedState.shortRestTracker?.lastRestDay ?? getGameDay(gameTimeFromLoad),
                lastRestEndedAtMs: loadedState.shortRestTracker?.lastRestEndedAtMs ?? null,
            };
            // TODO(lint-intent): The any on 'this value' hides the intended shape of this data.
            // TODO(lint-intent): Define a real interface/union (even partial) and push it through callers so behavior is explicit.
            // TODO(lint-intent): If the shape is still unknown, document the source schema and tighten types incrementally.
            const partyFromLoad = (loadedState.party && loadedState.party.length > 0)
                ? loadedState.party
                : loadedState.playerCharacter
                    ? [loadedState.playerCharacter]
                    : [];

            for (const npcId in loadedState.npcMemory) {
                const memory = loadedState.npcMemory[npcId];
                if (memory.knownFacts.length > 0 && typeof memory.knownFacts[0] === 'string') {
                    logger.info('Migrating knownFacts for NPC', { npcId });
                    const oldStringFacts = memory.knownFacts as unknown as string[];
                    memory.knownFacts = oldStringFacts.map((factText): KnownFact => ({
                        id: generateId(),
                        text: factText,
                        // Preserve a direct provenance label on migrated facts so later readers
                        // can tell imported memories from derived ones. This is fact metadata,
                        // not companion approval routing.
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

            // Validate and preserve 3D view state (world-3d-ui).
            // Legacy saves may not have these fields, so provide safe defaults.
            const loadedWorldViewMode = loadedState.worldViewMode ?? 'atlas';
            const loadedMapSurface = loadedState.mapSurface ?? 'classic';
            const loadedPlayerWorldPos = loadedState.playerWorldPos ?? null;

            // If loading into 3D mode, validate that position is complete —
            // and clamp it into the world grid. Saves written before the
            // dispatch-side clamp carry off-map camera positions (z=-881 in
            // the audited autosave); resuming them centered the 3D streamer
            // outside the grid and the player came back to a featureless
            // slab (resume-journey task 2). Healing here fixes old saves.
            const completePlayerWorldPos = loadedPlayerWorldPos &&
                typeof loadedPlayerWorldPos.x === 'number' &&
                typeof loadedPlayerWorldPos.y === 'number' &&
                typeof loadedPlayerWorldPos.z === 'number'
                ? loadedPlayerWorldPos
                : null;
            const loadedGridSize =
                (loadedState.mapData as { gridSize?: { cols: number; rows: number } } | null)?.gridSize
                ?? { cols: 60, rows: 40 };
            const worldDims = gridWorldDimensions(loadedGridSize.cols, loadedGridSize.rows);
            const validatedPlayerWorldPos = completePlayerWorldPos
                ? {
                    x: Math.min(Math.max(completePlayerWorldPos.x, 0), worldDims.widthM),
                    y: completePlayerWorldPos.y,
                    z: Math.min(Math.max(completePlayerWorldPos.z, 0), worldDims.heightM),
                }
                : null;

            return {
                ...loadedState,
                phase: GamePhase.LOAD_TRANSITION,
                // Preserve 3D view state from save (with validation).
                worldViewMode: loadedWorldViewMode,
                mapSurface: loadedMapSurface,
                playerWorldPos: validatedPlayerWorldPos,
                // Streamed 3D and legacy ThreeDModal must not both be active after load (W3DUI-22).
                isThreeDVisible:
                    loadedWorldViewMode === '3d' ? false : (loadedState.isThreeDVisible ?? false),
                // Keep preference from the current session (user-level), not the save slot payload.
                autoSaveEnabled: state.autoSaveEnabled ?? loadedState.autoSaveEnabled ?? true,
                isLoading: false, loadingMessage: null, isImageLoading: false, error: null,
                // Player-facing overlays (map/submap/journal) resume as saved
                // (resume-journey task 4); strict-boolean check heals legacy
                // saves. Dev/debug surfaces stay forced closed.
                isMapVisible: loadedState.isMapVisible === true,
                isDiscoveryLogVisible: loadedState.isDiscoveryLogVisible === true,
                isDevMenuVisible: false, isPartyEditorVisible: false,
                isPartyOverlayVisible: false, isGeminiLogViewerVisible: false, isOllamaLogViewerVisible: false,
                isGlossaryVisible: false, selectedGlossaryTermForModal: undefined, isLogbookVisible: false,
                isGameGuideVisible: false, isThievesGuildVisible: false,
                isNavalDashboardVisible: loadedState.isNavalDashboardVisible ?? false,
                isLockpickingModalVisible: loadedState.isLockpickingModalVisible ?? false,
                activeLock: loadedState.activeLock ?? null,
                isPuzzleRuntimeVisible: loadedState.isPuzzleRuntimeVisible ?? false,
                activePuzzle: loadedState.activePuzzle ?? null,
                isDiceRollerVisible: loadedState.isDiceRollerVisible ?? false,
                visualDiceEnabled: loadedState.visualDiceEnabled ?? true,
                geminiGeneratedActions: null,
                party: partyFromLoad.map(p => ({ ...(p as PlayerCharacter), equippedItems: (p as PlayerCharacter).equippedItems || {} })),
                inventory: migratedInventory,
                gold: migratedGold,
                currentLocationActiveDynamicNpcIds: determineActiveDynamicNpcsForLocation(loadedState.currentLocationId, LOCATIONS),
                characterSheetModal: loadedState.characterSheetModal || { isOpen: false, character: null },
                gameTime: gameTimeFromLoad,
                geminiInteractionLog: loadedState.geminiInteractionLog || [],
                ollamaInteractionLog: loadedState.ollamaInteractionLog || [],
                inspectedTileDescriptions: loadedState.inspectedTileDescriptions || {},
                discoveryLog: loadedState.discoveryLog || [],
                unreadDiscoveryCount: loadedState.unreadDiscoveryCount || 0,
                metNpcIds: loadedState.metNpcIds || [],
                locationResidues: loadedState.locationResidues || {},
                merchantModal: { isOpen: false, merchantName: '', merchantInventory: [] },
                questLog: loadedState.questLog || [],
                isQuestLogVisible: false,
                divineFavor: loadedState.divineFavor || INITIAL_DIVINE_FAVOR,
                notoriety: loadedState.notoriety || { globalHeat: 0, localHeat: {}, knownCrimes: [] },
                notifications: [],
                // Use loaded or fallback
                factions: loadedFactions,
                playerFactionStandings: loadedStandings,
                // Older saves may not carry rumor arrays at all. Normalize them
                // once at load so world simulation and UI code receive a stable
                // world-state shape without rejecting the save.
                activeRumors: loadedState.activeRumors ?? [],
                // Older saves can still load without a first-build payload; keep
                // an empty registry so the rest of the game can treat history as present.
                worldHistory: loadedState.worldHistory ?? createEmptyHistory(),
                // Saves predating the living-world sim have no townSim; default it
                // so registration/advance never dereference undefined.
                townSim: loadedState.townSim ?? {},
                shortRestTracker: resolvedShortRestTracker,
                underdark: loadedState.underdark || INITIAL_UNDERDARK_STATE,
                naval: loadedState.naval || { ...INITIAL_NAVAL_STATE },
                dynamicLocations: loadedState.dynamicLocations || {},
                activeDialogueSession: null,
                activeConversation: null,
                isDialogueInterfaceOpen: false,
                banterCooldowns: loadedState.banterCooldowns || {}
            };
        }

        case 'MOVE_PLAYER': {
            const movedMapData = action.payload.mapData || state.mapData;
            // GRID-RETIRE: BA-2 — Stage 4 cell-native arrival. A Travel-mode atlas pick
            // carries the EXACT destination cell + anchor; arrival lands that cell
            // intact (not the lossy `coord_X_Y` reverse-derive), RESETS Locale feet (the
            // old Locale's feet are meaningless in the new cell — mirrors how this case
            // nulls `entry3DAnchor`), and stamps the anchor so a later Enter-3D frames
            // the destination town. The legacy `coord_X_Y`/`subMapCoordinates` below stay
            // as bookkeeping (the surviving BA-2 compromise) until Stage 6. When
            // `destinationCell` is absent (compass/static moves) behaviour is unchanged.
            const dest = action.payload.destinationCell;
            const arrivalPlayerCell: PlayerCell | null = dest
                ? { cellId: dest.cellId, localeCoords: null }
                : derivePlayerCell(
                    state.worldSeed,
                    action.payload.newLocationId,
                    action.payload.newSubMapCoordinates,
                    movedMapData,
                );
            return {
                ...state,
                currentLocationId: action.payload.newLocationId,
                subMapCoordinates: action.payload.newSubMapCoordinates,
                // Record the canonical cell (cell-native world). Stage 2 derived it as a
                // shadow of the legacy tile; Stage 4 makes the atlas-travel destination
                // authoritative (carried intact, feet reset). The legacy fields above
                // are unchanged — every existing reader keeps using them this stage.
                playerCell: arrivalPlayerCell,
                // Moving invalidates a start-selection / click entry anchor so a later 3D
                // entry doesn't snap back to the old town; an atlas-travel arrival
                // instead stamps the destination's anchor so Enter-3D frames that town.
                entry3DAnchor: dest ? dest.anchor : null,
                mapData: action.payload.mapData || state.mapData,
                currentLocationActiveDynamicNpcIds: action.payload.activeDynamicNpcIds,
                geminiGeneratedActions: null,
                lastInteractedNpcId: null,
                lastNpcResponse: null,
                merchantModal: { isOpen: false, merchantName: '', merchantInventory: [] },
                isDialogueInterfaceOpen: false,
                activeDialogueSession: null,
                activeConversation: null
            };
        }

        case 'INITIALIZE_DUMMY_PLAYER_STATE': {
            // Use a fresh time reference so rest tracking stays aligned in dev flow.
            const dummyGameTime = createInitialGameTime();
            return {
                ...state,
                worldSeed: action.payload.worldSeed,
                messages: [
                    { id: Date.now() + Math.random(), text: `Welcome, ${state.party[0]!.name} and party! Your adventure begins (Dev Mode - Auto Start).`, sender: 'system', timestamp: new Date(dummyGameTime.getTime()) },
                    { id: Date.now() + Math.random() + 1, text: action.payload.initialLocationDescription, sender: 'system', timestamp: new Date(dummyGameTime.getTime()) }
                ],
                subMapCoordinates: action.payload.initialSubMapCoordinates,
                // Keep the canonical cell self-consistent with the dev spawn's
                // location (null for the static 'clearing' start tile).
                playerCell: derivePlayerCell(
                    action.payload.worldSeed,
                    state.currentLocationId,
                    action.payload.initialSubMapCoordinates,
                    action.payload.mapData,
                ),
                isLoading: false, loadingMessage: null, isImageLoading: false,
                mapData: action.payload.mapData,
                dynamicLocationItemIds: action.payload.dynamicLocationItemIds,
                inventory: [...action.payload.initialInventory],
                gold: 100,
                currentLocationActiveDynamicNpcIds: action.payload.initialActiveDynamicNpcIds,
                gameTime: dummyGameTime,
                // Reset short rest pacing in lockstep with the dev seed clock.
                shortRestTracker: {
                    restsTakenToday: 0,
                    lastRestDay: getGameDay(dummyGameTime),
                    lastRestEndedAtMs: null,
                },
                questLog: [],
                isQuestLogVisible: false,
                notifications: [],
            };
        }

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

        case 'PLACE_AREA_ITEMS': {
            // Stamp the foraged items onto the tile. Setting the key (even to an
            // empty array) is what marks the tile as "already searched", so a
            // fruitless or fully-looted tile cannot be re-foraged for new loot.
            const { locationId, itemIds } = action.payload;
            return {
                ...state,
                dynamicLocationItemIds: {
                    ...state.dynamicLocationItemIds,
                    [locationId]: itemIds,
                },
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
                isMapVisible: false, isDiscoveryLogVisible: false, isGlossaryVisible: false, merchantModal: { isOpen: false, merchantName: '', merchantInventory: [] }
            };
        }

        case 'START_BATTLE_MAP_ENCOUNTER': {
            // Use 'as any' to bypass the discriminated union strictness for now, relying on runtime shape
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const payload = action.payload as any;
            const encounterPayload = payload.startBattleMapEncounterData as import('../types').StartBattleMapEncounterPayload;
            const combatants = encounterPayload.combatants ?? [];
            return {
                ...state,
                phase: GamePhase.COMBAT, // Now transitions to the actual combat phase
                currentEnemies: combatants,
                // Store the pre-extracted battle map (if present) to bypass procedural generation
                extractedBattleMap: encounterPayload.extractedBattleMap ?? null,
                isEncounterModalVisible: false,
                isLongRestModalVisible: false,
                isMapVisible: false, isDiscoveryLogVisible: false, isGlossaryVisible: false, merchantModal: { isOpen: false, merchantName: '', merchantInventory: [] }
            };
        }

        case 'END_BATTLE': {
            const rewards = action.payload?.rewards;
            let newState = {
                ...state,
                phase: GamePhase.PLAYING,
                currentEnemies: null,
                // Reset the pre-extracted battle map when combat ends
                extractedBattleMap: null,
            };

            if (rewards && typeof rewards.xp === 'number') {
                // Distribute XP evenly to all party members and process any resulting level ups.
                const updatedParty = state.party.map((member) =>
                    applyXpAndHandleLevelUps(member, rewards.xp / state.party.length)
                );

                // Capture celebratory messages for characters who leveled up.
                const levelUpMessages: GameState['messages'] = updatedParty
                    .filter((member, index) => {
                        const previousLevel = state.party[index]?.level ?? 0;
                        const nextLevel = member.level ?? previousLevel;
                        return nextLevel > previousLevel;
                    })
                    .map((member, index): GameState['messages'][number] => {
                        const safeLevel = member.level ?? state.party[index]?.level ?? 0;
                        return {
                            id: Date.now() + index + 1,
                            text: `${member.name} reached level ${safeLevel}!`,
                            sender: 'system',
                            timestamp: inGameTimestamp(state.gameTime)
                        };
                    });

                // Queue follow-up prompts when XP gains still leave level-ups available.
                const pendingLevelUpMessages: GameState['messages'] = updatedParty
                    .map((member, index): GameState['messages'][number] | null => {
                        if (!canLevelUp(member)) return null;
                        const previousLevel = state.party[index]?.level ?? member.level ?? 1;
                        const currentLevel = member.level ?? previousLevel;
                        const leveledThisReward = currentLevel > previousLevel;
                        const prompt = leveledThisReward
                            ? `${member.name} can level up again. Open the character sheet to keep going.`
                            : `${member.name} has enough XP to level up. Open the character sheet to choose rewards.`;
                        return {
                            id: Date.now() + index + 200,
                            text: prompt,
                            sender: 'system',
                            timestamp: inGameTimestamp(state.gameTime)
                        };
                    })
                    .filter((message): message is GameState['messages'][number] => message !== null);

                const rewardItems = rewards.items ?? [];
                const itemsFoundMessage = rewardItems.length > 0
                    ? `You found: ${rewardItems.map(i => i.name).join(', ')}.`
                    : 'You found no items.';

                const victoryMessage: GameState['messages'][number] = {
                    id: Date.now(),
                    text: `Victory! The party gained ${rewards.xp} XP and ${rewards.gold || 0} gold. ${itemsFoundMessage}`,
                    sender: 'system',
                    timestamp: inGameTimestamp(state.gameTime)
                };

                newState = {
                    ...newState,
                    party: updatedParty,
                    gold: newState.gold + (rewards.gold || 0),
                    inventory: [...newState.inventory, ...rewardItems],
                    messages: [
                        ...newState.messages,
                        victoryMessage,
                        ...levelUpMessages,
                        ...pendingLevelUpMessages,
                    ]
                };
            } else {
                const endMessage: GameState['messages'][number] = {
                    id: Date.now(),
                    text: `The battle ends.`,
                    sender: 'system',
                    timestamp: inGameTimestamp(state.gameTime)
                };
                newState = {
                    ...newState,
                    messages: [...newState.messages, endMessage],
                };
            }
            return newState;
        }

        case 'UPDATE_BANTER_COOLDOWN':
            return {
                ...state,
                banterCooldowns: {
                    ...state.banterCooldowns,
                    [action.payload.banterId]: action.payload.timestamp
                }
            };

        // 3D World Transition (world-3d-ui)
        case 'SET_PLAYER_WORLD_POS':
            return { ...state, playerWorldPos: action.payload };

        case 'CLEAR_PLAYER_WORLD_POS':
            return { ...state, playerWorldPos: null };

        case 'SET_ENTRY_3D_ANCHOR':
            return { ...state, entry3DAnchor: action.payload };

        case 'CLEAR_ENTRY_3D_ANCHOR':
            return { ...state, entry3DAnchor: null };

        case 'SET_WORLD_VIEW_MODE':
            // PLAYING streamed 3D owns the canvas; never stack legacy ThreeDModal on top (W3DUI-22).
            return {
                ...state,
                worldViewMode: action.payload,
                ...(action.payload === '3d' ? { isThreeDVisible: false } : {}),
            };

        case 'SET_MAP_SURFACE':
            // Swap the 2D cartographic surface (classic GameLayout ↔ native
            // Worldforge cartographer). Independent of worldViewMode (3D).
            return { ...state, mapSurface: action.payload };

        // 2. Delegate to slice reducers for single-domain actions
        // RALPH: Pipeline Pattern.
        // We sequentially apply each slice reducer to the state.
        // This ensures that if multiple reducers react to the same action, their changes are combined
        // rather than overwritten by the last spread operator.
        default: {
            let nextState = { ...state };

            // Core UI & Systems
            nextState = { ...nextState, ...uiReducer(nextState, action) };
            nextState = { ...nextState, ...religionReducer(nextState, action) };
            nextState = { ...nextState, ...characterReducer(nextState, action) };
            nextState = { ...nextState, ...worldReducer(nextState, action) };
            nextState = { ...nextState, ...logReducer(nextState, action) };

            // Specific Domain Systems
            nextState = { ...nextState, ...encounterReducer(nextState, action) };
            nextState = { ...nextState, ...npcReducer(nextState, action) };
            nextState = { ...nextState, ...questReducer(nextState, action) };
            nextState = { ...nextState, ...townReducer(nextState, action) };
            nextState = { ...nextState, ...crimeReducer(nextState, action) };
            nextState = { ...nextState, ...companionReducer(nextState, action) };
            nextState = { ...nextState, ...identityReducer(nextState, action) };
            nextState = { ...nextState, ...dialogueReducer(nextState, action) };
            nextState = { ...nextState, ...craftingReducer(nextState, action) };
            nextState = { ...nextState, ...conversationReducer(nextState, action) };
            nextState = { ...nextState, ...journalReducer(nextState, action) };
            nextState = { ...nextState, ...legacyReducer(nextState, action) };
            nextState = { ...nextState, ...economyReducer(nextState, action) };
            nextState = { ...nextState, ...gameEntryReducer(nextState, action) };
            // Naval (ships, crew, voyages). navalReducer returns a full GameState,
            // so it runs last and its result is spread over the accumulated state.
            // Without this line every NAVAL_* action (voyage start/advance/clear,
            // known-ports sync, fleet acquisition) was a silent no-op in production.
            nextState = { ...nextState, ...navalReducer(nextState, action) };

            return nextState;
        }
    }
}
