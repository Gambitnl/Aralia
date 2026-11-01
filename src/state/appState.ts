/**
 * @file src/state/appState.ts
 * Defines the state structure, initial state, actions, and the root reducer for the application.
 * The root reducer orchestrates calls to smaller "slice" reducers for better modularity.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 19:01:52
 * Dependents: App.tsx, components/DesignPreview/steps/PreviewEconCraft.tsx, components/DesignPreview/steps/PreviewEquipment.tsx
 * Imports: 61 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { GameState, GamePhase, PlayerCharacter, SuspicionLevel, UnderdarkState, Companion, CompanionReactionRule, Relationship } from '../types';
import { CompanionSoul } from '../types/companion';
import { retainCompanionWhereabouts, companionsAtDestination } from '../systems/companions/companionWhereabouts';
import { prepareCompanionJourney } from '../systems/companions/companionJourney';
import { restoreAuthoredCompanionBuild } from '../systems/party/restoreAuthoredCompanionBuild';
import type { DivineFavor, NavalState } from '../types';
import { AppAction } from './actionTypes';
import { isPreparedConcentrationStatus } from '../utils/spells/outOfCombatCasting';
import { DEFAULT_WEATHER } from '../systems/environment/EnvironmentSystem';
import { STARTING_LOCATION_ID, LOCATIONS } from '../data/world/locations';
import { NPCS } from '../data/world/npcs';
import { COMPANIONS } from '../data/companions';
import { FACTIONS, INITIAL_FACTION_STANDINGS } from '../data/factions';
import { getAllFactions } from '../utils/world';
import { DEITIES } from '../data/deities';
import { TEMPLES } from '../data/temples';
import { canUseDevTools } from '../utils/core';
import { parseCellLocationId } from '../utils/location/cellLocationId';
import type { PlayerCell } from '../types/state';
import { getGameDay, inGameTimestamp } from '../utils/core';
import * as SaveLoadService from '../services/saveLoadService';
import { determineActiveDynamicNpcsForLocation } from '@/utils/spatial';
import { applyXpAndHandleLevelUps, canLevelUp } from '../utils/character';
import { logger } from '../utils/core';
import { INITIAL_TRADE_ROUTES } from '../data/tradeRoutes';
import { createEmptyHistory } from '../utils/world';
import { generateId } from '../utils/core/idGenerator';
import { migrateNpcMemoryRecord } from './migrations/npcMemoryMigration';
import { appendAdventureLogEntry } from '../systems/adventureLog/adventureLog';
import { gameEntryTransition } from '../systems/gameEntry/entryStateMachine';
import { deriveWatchReaction } from '../systems/social/watchReaction';
import { CrimeType } from '../types/crime';
import { CrimeSystem } from '../systems/crime/CrimeSystem';
import { INITIAL_GAME_ENTRY_STATE } from '../systems/gameEntry/types';
import { MOCK_SHIP_SLOOP } from '../data/dev/mockShips';
import { normalizeAtlasGroundAddress } from '../systems/worldforge/leaf3d/atlasGroundDrilldown';
import {
    normalizeAtlasGroundPosition,
    normalizeDiscoveredHiddenSites,
} from '../systems/worldforge/leaf3d/atlasGroundContinuity';

// Import slice reducers
import { uiReducer } from './reducers/uiReducer';
import { religionReducer } from './reducers/religionReducer';
import { characterReducer, instantiateItem } from './reducers/characterReducer';
import { worldReducer } from './reducers/worldReducer';
import {resolveDungeonBattle} from '../systems/worldforge/dungeon/world/dungeonCombatResolution';
import {reconcileSurfaceHostileOutcome} from '../systems/combat/worldScenario/surfaceHostileContinuity';
import { ritualReducer } from './reducers/ritualReducer';
import { logReducer } from './reducers/logReducer';
import { encounterReducer } from './reducers/encounterReducer';
import { npcReducer } from './reducers/npcReducer';
import { factReducer } from './reducers/factReducer';
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
import { getRulesEdition } from '../config/rulesEdition';
import { getAllowSaveScum, getDiceSaveCounter } from '../config/saveScum';
export { initialGameState, INITIAL_DIVINE_FAVOR };

/**
 * Derive the canonical player cell (cell-native world, Stage 2) from a legacy
 * location id + Locale-local position. The cell is a faithful shadow of the tile
 * the game already computes (via the existing golden reverse mapping); returns
 * null when it can't be resolved (e.g. the static 'clearing' node before spawn
 * relocation, or a generator hiccup) so the reducer never throws. Readers still
 * use the derived legacy fields this stage.
 *
 * GRID-RETIRE: the dead `subMapCoordinates` integer shadow (slice 4a) is gone, so
 * this path always passes a null Locale position. Continuous Locale feet are the
 * sole `localeCoords` producer now — written by the ground path (`worldReducer`
 * `SET_PLAYER_GROUND_POS`) whenever a ground/Locale session is active.
 */
function derivePlayerCell(
  locationId: string,
  localeCoords: { x: number; y: number } | null,
): PlayerCell | null {
  // Grid retirement: a cell-native `cell_<cellId>` id IS the cell. The 30×20 grid
  // is gone, so there is no tile→cell reverse-map: a non-cell id (a pre-migration
  // `coord_X_Y` save, or a static location) resolves to an honest null cell.
  const directCell = parseCellLocationId(locationId);
  return directCell != null ? { cellId: directCell, localeCoords } : null;
}

// RALPH: The Root Brain.
// Orchestrates the "Big Bang" of state updates.
// 1. Cross-Cutting Concerns: Handles actions that affect multiple systems (e.g. SET_GAME_PHASE, START_BATTLE).
// 2. Delegation: Forwards single-domain actions to specialized slice reducers.
/**
 * Slice reducers for single-domain actions, applied in this order by the
 * default branch of appReducer (RALPH pipeline pattern). Each result is
 * spread over the accumulated state, so when several slices react to one
 * action their changes combine instead of the last one overwriting the rest.
 * Adding a slice is one line here (C6, agora-9ed9.6).
 */
export interface SliceStep {
    /** Stable name, used by tests and diagnostics. */
    name: string;
    reduce: (state: GameState, action: AppAction) => Partial<GameState>;
    /** Return true to skip this slice for an action another owner handles. */
    skip?: (action: AppAction) => boolean;
}

export const SLICE_PIPELINE: readonly SliceStep[] = [
    // Core UI & Systems
    { name: 'ui', reduce: uiReducer },
    { name: 'religion', reduce: religionReducer },
    { name: 'character', reduce: characterReducer },
    { name: 'world', reduce: worldReducer },
    // Rituals (2026-09-13, agora-f4ab.4): START_RITUAL, ADVANCE_RITUAL,
    // INTERRUPT_RITUAL and COMPLETE_RITUAL were silent no-ops in
    // production because ritualReducer only ran inside worldReducer for
    // ADVANCE_TIME. It now runs here for every other action; ADVANCE_TIME
    // stays with worldReducer so progress is not advanced twice.
    { name: 'ritual', reduce: ritualReducer, skip: (action) => action.type === 'ADVANCE_TIME' },
    { name: 'log', reduce: logReducer },

    // Specific Domain Systems
    { name: 'encounter', reduce: encounterReducer },
    { name: 'npc', reduce: npcReducer },
    // Durable world-level fact store (DIAL-002/DIAL-004)
    { name: 'fact', reduce: factReducer },
    { name: 'quest', reduce: questReducer },
    { name: 'town', reduce: townReducer },
    { name: 'crime', reduce: crimeReducer },
    { name: 'companion', reduce: companionReducer },
    { name: 'identity', reduce: identityReducer },
    { name: 'dialogue', reduce: dialogueReducer },
    { name: 'crafting', reduce: craftingReducer },
    { name: 'conversation', reduce: conversationReducer },
    { name: 'journal', reduce: journalReducer },
    { name: 'legacy', reduce: legacyReducer },
    { name: 'economy', reduce: economyReducer },
    { name: 'gameEntry', reduce: gameEntryReducer },
    // Naval (ships, crew, voyages). navalReducer returns a full GameState,
    // so it runs last and its result is spread over the accumulated state.
    // Without this line every NAVAL_* action (voyage start/advance/clear,
    // known-ports sync, fleet acquisition) was a silent no-op in production.
    { name: 'naval', reduce: navalReducer },
];

export function appReducer(state: GameState, action: AppAction): GameState {
    // 1. Handle actions with cross-cutting concerns first
    switch (action.type) {
        case 'SET_AUTO_SAVE_ENABLED': {
            return { ...state, autoSaveEnabled: action.payload };
        }
        case 'SET_COMBAT_DIFFICULTY': {
            return { ...state, combatDifficulty: action.payload };
        }
        case 'SET_RULES_EDITION': {
            return { ...state, rulesEdition: action.payload };
        }

        case 'SET_ALLOW_SAVE_SCUM': {
            return { ...state, allowSaveScum: action.payload };
        }

        // The per-save counter lives in state so the NEXT save writes a
        // different one; saveGame reports the number it stored and the caller
        // dispatches it back.
        case 'SET_DICE_SAVE_COUNTER': {
            return { ...state, diceSaveCounter: action.payload };
        }
        case 'SET_WORLD_SEED': {
            // Reset naval.knownPorts so a mid-session seed change repopulates for
            // the new world (useKnownPortsSync re-fires when knownPorts is empty).
            return { ...state, worldSeed: action.payload, naval: { ...state.naval, knownPorts: [] } };
        }
        case 'SET_GAME_PHASE': {
            // A rejected surface outcome must not be bypassed by the next
            // terminal action in the same battle-end packet.
            if (action.payload === GamePhase.GAME_OVER && state.battlefieldSourceGap?.code === 'surface-outcome-source-mismatch'
                && state.extractedBattleMap?.encounterContext?.kind === 'surface-contact') return state;
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
                    // The title menu hides the meeting; it does not end it. Named
                    // Chronicles save this retained run from that menu. Only a
                    // new character starts without the current encounter.
                    currentLocationActiveDynamicNpcIds: action.payload === GamePhase.CHARACTER_CREATION
                        ? null : state.currentLocationActiveDynamicNpcIds,
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
                rulesEdition: getRulesEdition(state),
                allowSaveScum: getAllowSaveScum(state),
                diceSaveCounter: getDiceSaveCounter(state),
                worldSeed: state.worldSeed,
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
                rulesEdition: getRulesEdition(state),
                allowSaveScum: getAllowSaveScum(state),
                diceSaveCounter: getDiceSaveCounter(state),
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
                rulesEdition: getRulesEdition(state),
                allowSaveScum: getAllowSaveScum(state),
                diceSaveCounter: getDiceSaveCounter(state),
                worldSeed: state.worldSeed,
                party: newParty,
                tempParty: newParty.map(p => ({ id: p.id || generateId(), name: p.name, level: p.level || 1, classId: p.class.id })),
                inventory: [],
                gold: 50,
                currentLocationId: STARTING_LOCATION_ID,
                messages: [
                    { id: Date.now(), text: `A new party of adventurers emerges!`, sender: 'system', timestamp: new Date(initialGameState.gameTime.getTime()) },
                    { id: Date.now() + 1, text: initialLocation.baseDescription, sender: 'system', timestamp: new Date(initialGameState.gameTime.getTime()) }
                ],
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
            const { dynamicLocationItemIds, generatedParty, worldSeed, worldHistory } = action.payload;
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
                        history: [],
                    };
                }
            });

            return {
                ...initialGameState,
                phase: GamePhase.PLAYING,
                // Preserve user preference across resets.
                autoSaveEnabled: state.autoSaveEnabled ?? initialGameState.autoSaveEnabled,
                rulesEdition: getRulesEdition(state),
                allowSaveScum: getAllowSaveScum(state),
                diceSaveCounter: getDiceSaveCounter(state),
                worldSeed: worldSeed,
                party: generatedParty,
                tempParty: generatedParty.map(p => ({ id: p.id || generateId(), name: p.name, level: p.level || 1, classId: p.class.id })),
                inventory: [...action.payload.initialInventory],
                gold: 100, // Dummy gets some spending money
                currentLocationId: STARTING_LOCATION_ID,
                messages: [
                    { id: Date.now(), text: `Welcome, ${generatedParty[0].name} and party! Your adventure begins (Dev Mode).`, sender: 'system', timestamp: new Date(initialGameState.gameTime.getTime()) },
                    { id: Date.now() + 1, text: initialDummyLocation.baseDescription, sender: 'system', timestamp: new Date(initialGameState.gameTime.getTime()) }
                ],
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
                naval: {
                    playerShips: [MOCK_SHIP_SLOOP],
                    activeShipId: MOCK_SHIP_SLOOP.id,
                    currentVoyage: null,
                    knownPorts: []
                }
            };
        }

        case 'START_GAME_SUCCESS': {
            const { startingInventory, ...restOfPayload } = action.payload;
            const worldHistory = action.payload.worldHistory ?? createEmptyHistory();
            // Creation grants the purse once. Carried catalog coins keep their
            // quantities and source history until an actual payment spends them.
            const startingGold = restOfPayload.character.startingGold ?? 10;

            return {
                ...initialGameState,
                phase: GamePhase.PLAYING,
                // Preserve user preference across resets.
                autoSaveEnabled: state.autoSaveEnabled ?? initialGameState.autoSaveEnabled,
                rulesEdition: getRulesEdition(state),
                allowSaveScum: getAllowSaveScum(state),
                diceSaveCounter: getDiceSaveCounter(state),
                // Prefer the seed the world was actually generated with (carried
                // in the payload); fall back to the seed set during new-game setup.
                worldSeed: restOfPayload.worldSeed ?? state.worldSeed,
                // startingGold is a creation→game handoff hint only; consume it
                // into state.gold (above) and drop it from the live character.
                party: (() => {
                    const { startingGold: _startingGold, ...characterForParty } = restOfPayload.character;
                    return [{ ...characterForParty, equippedItems: characterForParty.equippedItems || {} }];
                })(),
                inventory: startingInventory,
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
                    restOfPayload.initialLocationId ?? STARTING_LOCATION_ID,
                    null, // Locale feet come from the ground session.
                ),
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
            const partyFromLoad = (loadedState.party && loadedState.party.length > 0)
                ? loadedState.party
                : loadedState.playerCharacter
                    ? [loadedState.playerCharacter]
                    : [];

            // NPC-memory load policy (G3, agora-f4e9): every saved NPC memory
            // entry runs through the extracted migration on load. It heals the
            // whole canonical shape (disposition / knownFacts / suspicion / goals),
            // keeps the original knownFacts lane (legacy string arrays become
            // canonical records; structured facts gain only the missing
            // strength-derived confidence/significance), and passes every other
            // optional field through untouched so sibling systems that attach data
            // to NpcMemory via intersection types do not lose it on reload.
            const migratedNpcMemory = migrateNpcMemoryRecord(
                loadedState.npcMemory,
                gameTimeFromLoad.getTime(),
            );

            // Loading resumes earned objects; it is not a sale or coin exchange.
            // Exact catalog currency is valued by partyFunds when actually spent.
            // Never erase similarly named treasures or collapse a stack to one GP.
            const migratedGold = loadedState.gold ?? 0;
            const migratedInventory = loadedState.inventory ?? [];

            // Load factions from state, falling back to getAllFactions if missing (legacy save support)
            const loadedFactions = loadedState.factions || getAllFactions(loadedState.worldSeed || Date.now());
            const loadedStandings = loadedState.playerFactionStandings || INITIAL_FACTION_STANDINGS;

            // Validate and preserve 3D view state (world-3d-ui).
            // Legacy saves may not have these fields, so provide safe defaults.
            // Wave 2 save migration: old saves simply have no native-Atlas
            // address, while malformed/newer address versions are discarded.
            // Semantic generator drift is checked by App before 3D can mount.
            const normalizedLoadedAddress = normalizeAtlasGroundAddress(
                loadedState.atlasGroundAddress,
            );
            // A completed journey owns its destination cell. Older saves could
            // retain the departed Local and one late footfall from that scene.
            // Discard only those foreign render coordinates; never replay travel
            // or restore its money, supplies, time, people or consequences.
            const loadedAtlasGroundAddress = normalizedLoadedAddress &&
                loadedState.playerCell &&
                normalizedLoadedAddress.atlasCellId !== loadedState.playerCell.cellId
                ? null : normalizedLoadedAddress;
            const foreignLoadedGround = loadedState.playerCell &&
                parseCellLocationId(loadedState.currentLocationId) === loadedState.playerCell.cellId &&
                loadedState.playerGroundPos && (
                    loadedState.playerGroundPos.tileX !== loadedState.playerCell.cellId ||
                    loadedState.playerGroundPos.tileY !== 0
                );
            const rejectedAtlasGroundAddress =
                loadedState.atlasGroundAddress != null && loadedAtlasGroundAddress === null;
            // Current meters are usable only when every lineage field matches the
            // accepted address. Wave 1/2 saves legitimately omit this new field
            // and safely resume at their selected focus.
            const loadedAtlasGroundPosition = loadedAtlasGroundAddress
                ? normalizeAtlasGroundPosition(
                    loadedState.atlasGroundPosition,
                    loadedAtlasGroundAddress,
                )
                : null;
            // A malformed address must never fall through to Classic's 3D
            // reconstruction. Legacy saves with no address keep their old mode.
            const loadedWorldViewMode = rejectedAtlasGroundAddress
                ? 'atlas'
                : (loadedState.worldViewMode ?? 'atlas');
            const loadedMapSurface = rejectedAtlasGroundAddress
                ? 'worldforge'
                : (loadedState.mapSurface ?? 'classic');
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
            // Grid retirement: the legacy continent position is vestigial — the
            // cell-native ground frames itself from the entry anchor, not this
            // value — so there is no 30×20 grid to clamp a resumed position into.
            const validatedPlayerWorldPos = completePlayerWorldPos;

            // Resume the people saved at this exact location. Rebuilding only
            // the static roster erased opening companions after a full reload.
            // This restores saved presence, never places a known person at a
            // new destination; travel still owns its normal location update.
            const configuredNpcIds = LOCATIONS[loadedState.currentLocationId]?.dynamicNpcConfig?.possibleNpcIds ?? [];
            const loadedLocalNpcIds = Array.from(new Set(
                Array.isArray(loadedState.currentLocationActiveDynamicNpcIds)
                    ? loadedState.currentLocationActiveDynamicNpcIds.filter(id => typeof id === 'string'
                        && Boolean(loadedState.generatedNpcs?.[id] || NPCS[id] || configuredNpcIds.includes(id)))
                    : determineActiveDynamicNpcsForLocation(loadedState.currentLocationId, LOCATIONS) ?? [],
            )).filter(id => !partyFromLoad.some(member => member.id === id)
                && loadedState.companions?.[id]?.inParty !== true);

            return {
                ...loadedState,
                // A defeat Chronicle is an aftermath, never a zero-HP exploration resume.
                phase: loadedState.phase === GamePhase.GAME_OVER ? GamePhase.GAME_OVER : GamePhase.LOAD_TRANSITION,
                // Preserve 3D view state from save (with validation).
                worldViewMode: loadedWorldViewMode,
                mapSurface: loadedMapSurface,
                playerWorldPos: validatedPlayerWorldPos,
                atlasGroundAddress: loadedAtlasGroundAddress,
                atlasGroundPosition: loadedAtlasGroundPosition,
                ...(foreignLoadedGround ? {
                    playerGroundPos: null,
                    playerCell: { ...loadedState.playerCell!, localeCoords: null },
                } : {}),
                // Streamed 3D and legacy ThreeDModal must not both be active after load (W3DUI-22).
                isThreeDVisible:
                    loadedWorldViewMode === '3d' ? false : (loadedState.isThreeDVisible ?? false),
                // Keep preference from the current session (user-level), not the save slot payload.
                autoSaveEnabled: state.autoSaveEnabled ?? loadedState.autoSaveEnabled ?? true,
                isLoading: false, loadingMessage: null, isImageLoading: false, error: null,
                // A save retains the paid night, never a stale quote or an
                // unconfirmed physical-bed admission from a previous UI frame.
                lodgingReservations: Array.isArray(loadedState.lodgingReservations) ? loadedState.lodgingReservations : [],
                lodgingOffer: null,
                lodgingRestAdmission: null,
                isLongRestModalVisible: false,
                isShortRestModalVisible: false,
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
                // Restore only the recognized legacy authored-recruit scaffold.
                // Earned HP/resources and every non-placeholder build survive.
                party: partyFromLoad.map(p => restoreAuthoredCompanionBuild(
                    { ...(p as PlayerCharacter), equippedItems: (p as PlayerCharacter).equippedItems || {} },
                    loadedState.companions?.[p.id], loadedState.generatedNpcs?.[p.id], loadedState,
                )),
                npcMemory: migratedNpcMemory,
                inventory: migratedInventory,
                gold: migratedGold,
                currentLocationActiveDynamicNpcIds: loadedLocalNpcIds.length > 0 ? loadedLocalNpcIds : null,
                characterSheetModal: loadedState.characterSheetModal || { isOpen: false, character: null },
                gameTime: gameTimeFromLoad,
                geminiInteractionLog: loadedState.geminiInteractionLog || [],
                ollamaInteractionLog: loadedState.ollamaInteractionLog || [],
                discoveryLog: loadedState.discoveryLog || [],
                // Legacy Classic pins survive; malformed/future Atlas provenance
                // is removed before any map can render it in the wrong world.
                discoveredHiddenSites: normalizeDiscoveredHiddenSites(
                    loadedState.discoveredHiddenSites,
                ),
                unreadDiscoveryCount: loadedState.unreadDiscoveryCount || 0,
                metNpcIds: loadedState.metNpcIds || [],
                locationResidues: loadedState.locationResidues || {},
                merchantModal: { isOpen: false, merchantName: '', merchantInventory: [] },
                questLog: loadedState.questLog || [],
                isQuestLogVisible: false,
                divineFavor: loadedState.divineFavor || INITIAL_DIVINE_FAVOR,
                notoriety: loadedState.notoriety || { globalHeat: 0, localHeat: {}, knownCrimes: [], bounties: [] },
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
                // Patrol receipts were introduced after physical WorldForge
                // deltas. Older saves begin with no consumed encounter events;
                // current saves preserve their deterministic daily receipts.
                worldforgeEncounterReceipts: loadedState.worldforgeEncounterReceipts ?? [],
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
            // Leaving a cell does not erase the people who remained behind.
            // Only the actual outgoing encounter can establish this placement.
            const shared = prepareCompanionJourney({ ...state, companions: retainCompanionWhereabouts(state) }, action.payload);
            if (shared.error) return { ...state, messages: [...state.messages, {
                id: Date.now(), text: shared.error, sender: 'system', timestamp: new Date(state.gameTime),
            }] };
            const companions = shared.companions;
            const destinationNpcIds = companionsAtDestination(state, companions,
                action.payload.newLocationId, action.payload.activeDynamicNpcIds);
            // Cell-native arrival. A Travel-mode atlas pick carries the EXACT
            // destination cell + anchor; arrival lands that cell intact, RESETS
            // Locale feet, and stamps the anchor so a later Enter-3D frames the
            // destination town. Absent a destinationCell, the cell is reverse-derived
            // from the coord_X_Y bookkeeping id. (Grid retirement: no mapData grid.)
            const dest = action.payload.destinationCell;
            const arrivalPlayerCell: PlayerCell | null = dest
                ? { cellId: dest.cellId, localeCoords: null }
                : derivePlayerCell(
                    action.payload.newLocationId,
                    null, // feet come from the ground session.
                );
            const arrivalPlaceName =
                (dest && (dest as { name?: string }).name) ||
                LOCATIONS[action.payload.newLocationId]?.name ||
                state.dynamicLocations?.[action.payload.newLocationId]?.name ||
                'a new place';
            return {
                ...state,
                currentLocationId: action.payload.newLocationId,
                // The move commits before ADVANCE_TIME. Only the journal uses
                // the explicit reached time; clock/resource behavior stays owned
                // by the existing subsequent travel actions. Legacy moves use now.
                ...appendAdventureLogEntry(action.payload.arrivalGameTime && Number.isFinite(Date.parse(action.payload.arrivalGameTime))
                    ? { ...state, gameTime: new Date(action.payload.arrivalGameTime) } : state, {
                    kind: 'travel',
                    summary: `Traveled to ${arrivalPlaceName}.`,
                    placeIds: [action.payload.newLocationId],
                }),
                // Record the canonical cell (cell-native world): the atlas-travel
                // destination is authoritative (carried intact, feet reset).
                playerCell: arrivalPlayerCell,
                // Locale meters are meaningful only inside their source cell.
                // Keeping them across atlas travel/remote 3D entry lets the new
                // ground scene spawn at coordinates from the previous locale.
                playerGroundPos: dest ? null : state.playerGroundPos,
                atlasGroundPosition: dest ? null : state.atlasGroundPosition,
                // The old Local must leave with its feet. Keeping its address
                // lets the outgoing scene revive inside the destination cell.
                atlasGroundAddress: dest ? null : state.atlasGroundAddress,
                // Moving invalidates a start-selection / click entry anchor so a later 3D
                // entry doesn't snap back to the old town; an atlas-travel arrival
                // instead stamps the destination's anchor so Enter-3D frames that town.
                entry3DAnchor: dest ? dest.anchor : null,
                companions,
                currentLocationActiveDynamicNpcIds: destinationNpcIds,
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
                // Keep the canonical cell self-consistent with the dev spawn's
                // location (null for the static 'clearing' start tile).
                playerCell: derivePlayerCell(
                    state.currentLocationId,
                    null, // no Locale feet; static dev spawn.
                ),
                isLoading: false, loadingMessage: null, isImageLoading: false,
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
            const encounterPayload = action.payload.startBattleMapEncounterData;
            const combatants = encounterPayload.combatants ?? [];
            return {
                ...state,
                phase: GamePhase.COMBAT, // Now transitions to the actual combat phase
                currentEnemies: combatants,
                // Preserve the caller's exact missing-source diagnosis. A
                // normal source-backed encounter clears any older gap record.
                battlefieldSourceGap: encounterPayload.sourceGap ?? null,
                // Store the pre-extracted battle map (if present) to bypass procedural generation
                extractedBattleMap: encounterPayload.extractedBattleMap ?? null,
                isEncounterModalVisible: false,
                isLongRestModalVisible: false,
                lodgingOffer: null,
                lodgingRestAdmission: null,
                isMapVisible: false, isDiscoveryLogVisible: false, isGlossaryVisible: false, merchantModal: { isOpen: false, merchantName: '', merchantInventory: [] }
            };
        }

        case 'END_BATTLE': {
            // Reconcile actual source actors while the exact map still exists,
            // before rewards or teardown can conceal a missing source outcome.
            const surfaceOutcome = reconcileSurfaceHostileOutcome(state, action.payload?.finalEnemyState,
                action.payload?.finalPartyState, action.payload?.outcomeReview?.result ?? (action.payload?.rewards ? 'victory' : 'ended'), Boolean(action.payload?.rewards));
            if (surfaceOutcome.status === 'duplicate') return state;
            if (surfaceOutcome.status === 'source-gap') return {...state, battlefieldSourceGap: {
                code: 'surface-outcome-source-mismatch', encounterLabel: 'Surface encounter',
                locationLabel: state.currentLocationId, missingSourceFacts: [surfaceOutcome.detail], detail: surfaceOutcome.detail,
            }};
            const dungeonResolution = resolveDungeonBattle(state, action);
            if (dungeonResolution === null) return state;
            const rewards = action.payload?.rewards;
            const review = action.payload?.outcomeReview;
            const dungeon = state.extractedBattleMap?.dungeonEncounter;
            // Copy public facts while the exact source context still exists.
            // Later fights and mutable tactical actors cannot rewrite this review.
            const lastCombatOutcome = review ? {
                ...review,
                party: review.party.map(member => ({...member,
                    ...(member.deathSaves ? {deathSaves: {...member.deathSaves}} : {})})),
                enemies: review.enemies.map(enemy => ({...enemy})),
                events: review.events.slice(-8).map(event => ({...event})),
                worldSeed: state.worldSeed ?? 0,
                currentLocationId: state.currentLocationId,
                gameTime: new Date(state.gameTime).toISOString(),
                ...(dungeon ? {dungeon: {identity: {...dungeon.rootIdentity}, encounterId: dungeon.encounterId, depth: dungeon.depth}} : {}),
            } : undefined;
            let newState = {
                ...state,
                ...dungeonResolution,
                ...surfaceOutcome.patch,
                // An older caller cannot borrow the preceding battle's review.
                lastCombatOutcome,
                phase: GamePhase.PLAYING,
                currentEnemies: null,
                battlefieldSourceGap: null,
                // Reset the pre-extracted battle map when combat ends
                extractedBattleMap: null,
            };

            const isVictory = Boolean(rewards && typeof rewards.xp === 'number');

            // Persist post-combat attrition (HP, spell slots, limited uses) for EVERY
            // battle outcome, including fleeing and retreats without rewards (GG-467).
            // Level-ups and XP are awarded subsequently if victory rewards were earned.
            const finalById = new Map(
                (action.payload?.finalPartyState ?? []).map(s => [s.id, s] as const)
            );
            const updatedParty = state.party.map((member) => {
                const snapshot = finalById.get(member.id);
                let afterCombat = member;
                if (snapshot) {
                    const maxHp = member.maxHp ?? member.hp ?? snapshot.currentHP;
                    // A member who ended a WON battle at 0 HP is stabilized — they
                    // come to after the fight — so floor at 1 rather than leaving
                    // them unconscious in the overworld with no handler.
                    // On flee or non-victory, keep their exact HP down to 0.
                    const minHp = isVictory ? 1 : 0;
                    const persistedHp = Math.max(minHp, Math.min(snapshot.currentHP, maxHp));
                    afterCombat = {
                        ...member,
                        hp: persistedHp,
                        spellSlots: snapshot.spellSlots ?? member.spellSlots,
                        limitedUses: snapshot.limitedUses ?? member.limitedUses,
                        // A broken prepared ward stays ended after returning to exploration.
                        // Remove only exact generated IDs reported by this holder's snapshot.
                        statusEffects: snapshot.endedPreparedConcentrationIds?.length
                            ? member.statusEffects?.filter(effect => !isPreparedConcentrationStatus(effect)
                                || !snapshot.endedPreparedConcentrationIds!.includes(effect.id))
                            : member.statusEffects,
                    };
                }
                if (isVictory && rewards) {
                    const rulesEdition = getRulesEdition(state);
                    return applyXpAndHandleLevelUps(afterCombat, rewards.xp / state.party.length, undefined, rulesEdition);
                }
                return afterCombat;
            });

            if (isVictory && rewards) {

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
                    // Instantiate reward items with independent ids and acquiredAt stamps (GG-460)
                    inventory: [...newState.inventory, ...rewardItems.map(item => instantiateItem(item))],
                    messages: [
                        ...newState.messages,
                        victoryMessage,
                        ...levelUpMessages,
                        ...pendingLevelUpMessages,
                    ],
                    ...appendAdventureLogEntry(newState, {
                        kind: 'combat',
                        summary: `Won a battle, gaining ${rewards.xp} XP${rewards.gold ? ` and ${rewards.gold} gold` : ''}.`,
                    }),
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
                    party: updatedParty,
                    messages: [...newState.messages, endMessage],
                };
            }

            // Post-combat NPC state: a battle that grew out of a hostile opening
            // situation ends with those strangers BEATEN. Mark them defeated so
            // the talk path no longer replays the pre-fight threat line, and tear
            // down the lingering opening (conversation + threat banner + entry
            // status) that would otherwise re-open as if nothing happened.
            const situation = state.gameEntry?.situation;
            const openingWasHostile =
                !!situation?.threat?.hostile && state.gameEntry?.status === 'in-situation';
            // Explicit losses and retreats do not declare the source NPCs beaten.
            // Legacy END_BATTLE callers without an outcome retain their existing path.
            if (openingWasHostile && situation && review?.result !== 'defeat' && review?.result !== 'flee') {
                const alreadyDefeated = new Set(newState.defeatedNpcIds ?? []);
                for (const npc of situation.npcs) alreadyDefeated.add(npc.id);
                newState = {
                    ...newState,
                    defeatedNpcIds: [...alreadyDefeated],
                    // Clear the pre-fight standoff. `activeConversation: null` drops
                    // the seeded threat panel; SKIPping the entry machine retires the
                    // opening for good (mirrors useDeEscalation's clearThreat, which
                    // fires on the peaceful/flee routes but NOT on a fight-to-victory).
                    activeConversation: null,
                    // Invalidate the seeded pre-fight utterance: DialogueInterface
                    // initializes its first line from `lastNpcResponse`, so leaving
                    // the opening threat line here made EVERY surviving/other NPC
                    // replay it post-combat. Clearing it lets the next talk generate
                    // a fresh, fight-aware line instead.
                    lastNpcResponse: null,
                    lastInteractedNpcId: null,
                    gameEntry: gameEntryTransition(
                        state.gameEntry ?? INITIAL_GAME_ENTRY_STATE,
                        { type: 'SKIP' },
                    ),
                };

                // Watch reaction (item 1): if the strangers the party just beat were
                // the town WATCH, the town notices. The player becomes wanted here (a
                // witnessed crime keyed to this town), every townsperson's disposition
                // drops, and the log records it. Scope is one town — no faction webs.
                const watchTownId = state.currentLocationId;
                // agora-31fa: severity now follows the actual combat outcome instead
                // of assuming every won fight was non-lethal. END_BATTLE carries the
                // enemy roster exactly as combat left it; an enemy token at or below
                // 0 HP is one the party KILLED (only PARTY members are stabilized to
                // 1 HP on a win, a few lines above). One dead watchman makes this a
                // Murder rather than an Assault.
                //
                // Resolution is per-combatant, not per-scene-NPC id, because a
                // hostile opening spawns its watch as bestiary monsters via
                // threatToMonsters — the scene NPC ids never reach the battle map.
                const finalEnemyState = action.payload?.finalEnemyState ?? [];
                const killedEnemyCount = finalEnemyState.filter(
                    (enemy) => enemy.currentHP <= 0,
                ).length;
                const watchReaction = deriveWatchReaction(situation, watchTownId, {
                    openingWasHostile: true,
                    watchNpcDied: killedEnemyCount > 0,
                });
                if (watchReaction) {
                    // Record the crime the same way COMMIT_CRIME does, so bounty +
                    // "wanted" semantics stay consistent with the crime system.
                    const normalizedSeverity = CrimeSystem.normalizeSeverity(watchReaction.crime.severity);
                    const newCrime = {
                        id: generateId(),
                        type: watchReaction.crime.type,
                        locationId: watchReaction.crime.locationId,
                        timestamp: state.gameTime.getTime(),
                        severity: normalizedSeverity,
                        witnessed: true,
                        victimId: watchReaction.crime.victimId,
                    };
                    const heatIncrease = CrimeSystem.calculateCrimeHeat(normalizedSeverity, true);
                    const currentLocalHeat = newState.notoriety.localHeat[watchReaction.crime.locationId] || 0;
                    const newBounty = CrimeSystem.generateBounty(newCrime);

                    // Drop the disposition of every townsperson the player has met
                    // (they now see an outlaw who fought the watch).
                    const loweredMemory: GameState['npcMemory'] = { ...newState.npcMemory };
                    for (const npcId of Object.keys(loweredMemory)) {
                        const mem = loweredMemory[npcId];
                        if (!mem) continue;
                        loweredMemory[npcId] = {
                            ...mem,
                            disposition: Math.max(-100, mem.disposition + watchReaction.dispositionPenalty),
                        };
                    }

                    newState = {
                        ...newState,
                        npcMemory: loweredMemory,
                        notoriety: {
                            ...newState.notoriety,
                            globalHeat: Math.min(100, newState.notoriety.globalHeat + heatIncrease * 0.1),
                            localHeat: {
                                ...newState.notoriety.localHeat,
                                [watchReaction.crime.locationId]: Math.min(100, currentLocalHeat + heatIncrease),
                            },
                            knownCrimes: [...newState.notoriety.knownCrimes, newCrime],
                            bounties: newBounty
                                ? [...(newState.notoriety.bounties || []), newBounty]
                                : newState.notoriety.bounties,
                        },
                        messages: [
                            ...newState.messages,
                            {
                                id: Date.now() + 5,
                                text: watchReaction.crime.type === CrimeType.Murder
                                    ? `The watch lies dead, and witnesses saw everything. You are now wanted in ${watchTownId}.`
                                    : `The watch is beaten, but witnesses saw everything. You are now wanted in ${watchTownId}.`,
                                sender: 'system',
                                timestamp: inGameTimestamp(state.gameTime),
                            },
                        ],
                        ...appendAdventureLogEntry(newState, {
                            kind: 'combat',
                            summary: watchReaction.logSummary,
                        }),
                    };
                }
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

        case 'SET_ATLAS_GROUND_ADDRESS': {
            // The action accepts only the compact schema; normalizing again
            // protects reducer tests and future dispatchers that bypass Atlas.
            const nextAtlasGroundAddress = normalizeAtlasGroundAddress(action.payload);
            return {
                ...state,
                atlasGroundAddress: nextAtlasGroundAddress,
                // Clearing or replacing an address also invalidates foreign live
                // meters. A matching position survives phase-only round trips.
                atlasGroundPosition: nextAtlasGroundAddress
                    ? normalizeAtlasGroundPosition(
                        state.atlasGroundPosition,
                        nextAtlasGroundAddress,
                    )
                    : null,
            };
        }

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
            // C6 (agora-9ed9.6): the pipeline is the SLICE_PIPELINE table above;
            // same order, same spread-merge, same ritual skip as the old lines.
            let nextState = { ...state };
            for (const slice of SLICE_PIPELINE) {
                if (slice.skip?.(action)) continue;
                nextState = { ...nextState, ...slice.reduce(nextState, action) };
            }
            return nextState;
        }
    }
}
