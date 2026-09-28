/**
 * @file src/state/reducers/townReducer.ts
 * Reducer for the temple modal (village temple UI) and the town rumor mill.
 *
 * Formerly also handled the legacy 2D town-exploration state (player movement,
 * entering/exiting towns, viewport). That 2D village view was retired in the
 * grid-retirement program (slices 1a/1b).
 *
 * It now handles two things:
 *   - OPEN_TEMPLE / CLOSE_TEMPLE, the still-live temple modal.
 *   - The town rumor mill (agora-049c). This reducer is the bridge between
 *     notable player deeds and the pure gossip engine in
 *     src/systems/intrigue/RumorMillSystem.ts. It needs no new action types:
 *     COMPLETE_QUEST and COMMIT_CRIME already cross the root reducer, and
 *     ADVANCE_TIME already ticks the day, so the mill is driven entirely off
 *     actions the shipped game dispatches today.
 */

import { GameState } from '../../types';
import { AppAction } from '../actionTypes';
import { generateVillageTemple } from '../../utils/world';
import { VillagePersonality } from '../../types/village';
import { getGameDay } from '../../utils/core';
import { SeededRandom } from '../../utils/random';
import { resolveTownForLocation } from '../../systems/worldforge/townsim/chronicleForLocation';
import type { TownSimState } from '../../systems/worldforge/townsim/types';
import {
    advanceRumors,
    buildSocialGraphFromBonds,
    generateRumor,
    type NotableDeed,
    type RumorSocialGraph,
    type TownRumor,
} from '../../systems/intrigue/RumorMillSystem';

/**
 * Rumor NPC ids are namespaced by town, so the union graph below can hold every
 * tracked town at once without two villagers sharing an id. Bonds never cross a
 * town boundary, so a rumor started in one town can only ever reach that town.
 */
function villagerRumorId(burgId: number, occupantId: number): string {
    return `villager_${burgId}_${occupantId}`;
}

/**
 * Who saw it. A deed only becomes gossip if somebody was there to see it, so
 * this returns null when the player is not standing in a tracked town or that
 * town has no living residents — nobody saw it, nobody talks.
 *
 * Deterministic: the same deed on the same day in the same town always picks the
 * same witness, so a replayed save tells the same story.
 */
function pickWitness(town: TownSimState, seed: number): string | null {
    const living = Object.values(town.villagers)
        .filter((villager) => villager.diedDay === undefined)
        .map((villager) => villager.occupantId)
        .sort((a, b) => a - b);
    if (living.length === 0) return null;
    const rng = new SeededRandom(seed);
    return villagerRumorId(town.burgId, rng.pick(living));
}

/**
 * The social web of every tracked town, merged into one graph. Ids are
 * town-namespaced, so the merge is a union of disjoint components and spread
 * stays inside the town the talk started in.
 *
 * A town with no agent-deepening payload contributes no edges: its bonds have
 * never been simulated, so there is no web to carry talk along.
 */
function buildTownSocialGraph(townSim: GameState['townSim']): RumorSocialGraph {
    const merged: RumorSocialGraph = { edges: {} };
    for (const town of Object.values(townSim ?? {})) {
        const relationships = town?.agentDeepening?.relationships;
        if (!relationships) continue;
        const graph = buildSocialGraphFromBonds(relationships, {
            idPrefix: `villager_${town.burgId}_`,
        });
        Object.assign(merged.edges, graph.edges);
    }
    return merged;
}

/** Appends a rumor, ignoring a repeat of one already in circulation (ids are stable). */
function withRumor(existing: TownRumor[], rumor: TownRumor): Partial<GameState> {
    if (existing.some((candidate) => candidate.id === rumor.id)) return {};
    return { townRumors: [...existing, rumor] };
}

/**
 * Turns a deed into town talk, if there is a town to talk in.
 * Returns {} when the player is not in a tracked town — a real "no gossip
 * applies" case, not a swallowed error.
 */
function recordDeed(
    state: GameState,
    deed: Omit<NotableDeed, 'sourceNpc' | 'day' | 'subject' | 'locationId'>,
): Partial<GameState> {
    const town = resolveTownForLocation({
        currentLocationId: state.currentLocationId,
        worldSeed: state.worldSeed,
        cellId: state.playerCell?.cellId,
        townSim: state.townSim ?? {},
        gameTime: state.gameTime,
    });
    if (!town) return {};

    const day = getGameDay(state.gameTime);
    const witness = pickWitness(town, state.worldSeed + town.burgId + day);
    if (!witness) return {};

    const rumor = generateRumor(
        {
            ...deed,
            day,
            sourceNpc: witness,
            subject: state.party[0]?.name,
            locationId: state.currentLocationId,
        },
        state.worldSeed,
    );

    return withRumor(state.townRumors ?? [], rumor);
}

/**
 * Handle temple-related actions and the town rumor mill, and return partial
 * state updates.
 */
export function townReducer(state: GameState, action: AppAction): Partial<GameState> {
    switch (action.type) {
        case 'OPEN_TEMPLE': {
            const { villageContext } = action.payload;
            // Generate a deterministic temple ID based on location
            const villageId = `${villageContext.worldX}_${villageContext.worldY}`;
            const personality = villageContext.personality || {
                wealth: 'comfortable',
                culture: 'stoic',
                biomeStyle: 'temperate',
                population: 'small',
                primaryIndustry: 'agriculture',
                architecturalStyle: 'medieval',
                governingBody: 'elder'
            } as VillagePersonality;

            // Use world seed + coords for deterministic temple generation
            const seed = state.worldSeed + villageContext.worldX + villageContext.worldY;
            const temple = generateVillageTemple(villageId, personality, seed);

            return {
                templeModal: {
                    isOpen: true,
                    temple: temple
                }
            };
        }

        case 'CLOSE_TEMPLE': {
            return {
                templeModal: {
                    isOpen: false,
                    temple: null
                }
            };
        }

        case 'COMPLETE_QUEST': {
            // The quest must be in the log to be named in the talk; questReducer
            // ignores a COMPLETE_QUEST for a quest that is not there, and so does this.
            const quest = state.questLog.find((entry) => entry.id === action.payload.questId);
            if (!quest) return {};
            return recordDeed(state, { kind: 'quest_completed', detail: quest.title });
        }

        case 'COMMIT_CRIME': {
            // Nobody saw it, nobody talks. An unwitnessed crime leaves no gossip.
            if (!action.payload.witnessed) return {};
            // CrimeSystem.normalizeSeverity's scale: 1-10 payloads are scaled to
            // the canonical 0-100, and 0-100 payloads pass through.
            const severity = action.payload.severity;
            const normalized = severity <= 10 ? severity * 10 : severity;
            return recordDeed(state, {
                kind: 'crime',
                detail: `the ${String(action.payload.type).toLowerCase()}`,
                magnitude: Math.max(0, Math.min(1, normalized / 100)),
            });
        }

        case 'ADVANCE_TIME': {
            const rumors = state.townRumors;
            if (!rumors || rumors.length === 0) return {};

            // worldReducer runs before this reducer in the root pipeline, so
            // state.gameTime is already the post-tick time. The day the tick
            // started from is recovered by subtracting the advance.
            const toDay = getGameDay(state.gameTime);
            const fromDay = getGameDay(
                new Date(state.gameTime.getTime() - action.payload.seconds * 1000),
            );
            if (toDay <= fromDay) return {};

            const graph = buildTownSocialGraph(state.townSim);
            return {
                townRumors: advanceRumors(rumors, graph, fromDay + 1, toDay, state.worldSeed),
            };
        }

        default:
            return {};
    }
}
