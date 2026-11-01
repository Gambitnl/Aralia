/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/state/reducers/gameEntryReducer.ts
 *
 * Slice reducer for the opening-situation entry state machine. Owns the
 * `gameEntry` field of GameState and translates entry actions through the pure
 * {@link gameEntryTransition} machine so the transitions stay testable.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 14:27:28
 * Dependents: state/appState.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { GameState, SuspicionLevel } from '../../types';
import { AppAction } from '../actionTypes';
import { gameEntryTransition } from '../../systems/gameEntry/entryStateMachine';
import { INITIAL_GAME_ENTRY_STATE } from '../../systems/gameEntry/types';
import { retainCompanionWhereabouts, companionsAtDestination, isLocalCompanion } from '../../systems/companions/companionWhereabouts';

export function gameEntryReducer(state: GameState, action: AppAction): Partial<GameState> {
    const current = state.gameEntry ?? INITIAL_GAME_ENTRY_STATE;

    switch (action.type) {
        case 'BEGIN_OPENING_SITUATION':
            // From idle this BEGINs generation; from a prior failure it RETRIES.
            // Both land in `generating` so the orchestration hook fires the model.
            return {
                gameEntry: gameEntryTransition(
                    current,
                    current.status === 'model-unavailable' ? { type: 'RETRY' } : { type: 'BEGIN' },
                ),
            };

        case 'RESOLVE_OPENING_SITUATION':
            return {
                gameEntry: gameEntryTransition(current, { type: 'RESOLVED', situation: action.payload }),
            };

        case 'FAIL_OPENING_SITUATION':
            return {
                gameEntry: gameEntryTransition(current, { type: 'UNAVAILABLE', error: action.payload }),
            };

        case 'SKIP_OPENING_SITUATION': {
            // The generated opening is optional enrichment. If the local model
            // is unavailable or the player skips the opening scene, this action
            // dismisses the gate and transitions smoothly into live gameplay.
            const nextEntry = gameEntryTransition(current, { type: 'SKIP' });
            if (!state.messages || state.messages.length === 0) {
                const townName = state.startTownName || 'the settlement';
                const regionName = state.startTownRegion ? `, ${state.startTownRegion}` : '';
                return {
                    gameEntry: nextEntry,
                    messages: [
                        {
                            id: Date.now(),
                            text: `You arrive in ${townName}${regionName}. The sounds of daily life fill the air. Your journey begins.`,
                            sender: 'system',
                            timestamp: state.gameTime instanceof Date ? state.gameTime : new Date(),
                        },
                    ],
                };
            }
            return { gameEntry: nextEntry };
        }

        case 'RESET_OPENING_SITUATION':
            return { gameEntry: gameEntryTransition(current, { type: 'RESET' }) };

        // Scene-illustration lifecycle. Kept orthogonal to the entry status machine
        // (the picture is optional enrichment) — these only touch `sceneImage`.
        case 'SCENE_IMAGE_REQUEST_START':
            return { gameEntry: { ...current, sceneImage: { status: 'generating', url: null, error: null } } };

        case 'SCENE_IMAGE_REQUEST_SUCCESS':
            return { gameEntry: { ...current, sceneImage: { status: 'ready', url: action.payload.url, error: null } } };

        case 'SCENE_IMAGE_REQUEST_ERROR':
            return { gameEntry: { ...current, sceneImage: { status: 'error', url: null, error: action.payload.error } } };

        case 'INITIALIZE_COMPANION_WORLD_PRESENCE': {
            // This action is emitted only for a newly created world. Never use
            // a plan to rewrite a meeting, saved point, party member or legacy life.
            let companions=state.companions,generatedNpcs=state.generatedNpcs,npcMemory=state.npcMemory;
            for(const activity of action.payload.activities){
                const id=activity.companionId,companion=companions[id],npc=action.payload.npcs.find(person=>person.id===id);
                if(!companion||!npc||activity.worldSeed!==state.worldSeed||activity.version!==1
                  ||activity.sourceId!==`companion-activity-v1:${state.worldSeed}:${id}`
                  ||activity.locationId!==`cell_${activity.cellId}`||!Number.isInteger(activity.cellId)||activity.cellId<0
                  ||companion.whereabouts||companion.publicActivity||companion.inParty
                  ||state.metNpcIds.includes(id)||state.party.some(person=>person.id===id))continue;
                companions={...companions,[id]:{...companion,publicActivity:{...activity},whereabouts:{worldSeed:activity.worldSeed,
                  locationId:activity.locationId,source:'world-activity',observedAt:state.gameTime.getTime()}}};
                generatedNpcs={...generatedNpcs,[id]:npc};
                if(!npcMemory[id])npcMemory={...npcMemory,[id]:{disposition:0,knownFacts:[],suspicion:SuspicionLevel.Unaware,goals:[],interactions:[],attitude:0,discussedTopics:{},lastInteractionDate:null}};
            }
            if(companions===state.companions)return {};
            const active=companionsAtDestination({...state,generatedNpcs},companions,state.currentLocationId,state.currentLocationActiveDynamicNpcIds);
            return {companions,generatedNpcs,npcMemory,currentLocationActiveDynamicNpcIds:active};
        }

        case 'PLACE_SITUATION_NPCS': {
            // Place the generated strangers into the world: register them in the
            // runtime NPC registry AND add them to the current location's active
            // dynamic NPC list so the scene actually shows the event. Strangers
            // leave this temporary list on movement; companions retain their source place.
            // An opening model cannot summon or rewrite an authored person who
            // already has a source place. Keep their registered identity intact.
            const npcs = action.payload.npcs.filter(npc=>{
                const companion=state.companions[npc.id];
                return !companion?.whereabouts||isLocalCompanion(state,companion,state.currentLocationId);
            });
            if (npcs.length === 0) return {};

            const generatedNpcs = { ...state.generatedNpcs };
            for (const npc of npcs) {
                if(!state.companions[npc.id]||!generatedNpcs[npc.id])generatedNpcs[npc.id] = npc;
            }

            const existing = state.currentLocationActiveDynamicNpcIds ?? [];
            const merged = [...existing];
            for (const npc of npcs) {
                if (!merged.includes(npc.id)) merged.push(npc.id);
            }

            // Seed a memory record for each stranger so the opening conversation
            // (and later talks) can actually PERSIST something — met state, a
            // remembered fact, a shifting disposition. Without this seed the
            // npcMemory-keyed reducers no-op for these NPCs and the encounter
            // leaves no trace. Only seed when absent (never clobber a prior memory).
            const npcMemory = { ...state.npcMemory };
            for (const npc of npcs) {
                if (!npcMemory[npc.id]) {
                    npcMemory[npc.id] = {
                        disposition: 0,
                        knownFacts: [],
                        suspicion: SuspicionLevel.Unaware,
                        goals: [],
                        interactions: [],
                        attitude: 0,
                        discussedTopics: {},
                        lastInteractionDate: null,
                    };
                }
            }

            return {
                generatedNpcs,
                companions: retainCompanionWhereabouts({ ...state, generatedNpcs }, merged),
                currentLocationActiveDynamicNpcIds: merged,
                npcMemory,
            };
        }

        default:
            return {};
    }
}
