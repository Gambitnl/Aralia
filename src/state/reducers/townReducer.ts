/**
 * @file src/state/reducers/townReducer.ts
 * Reducer for the temple modal (village temple UI) and the town rumor mill.
 *
 * Formerly also handled the legacy 2D town-exploration state (player movement,
 * entering/exiting towns, viewport). That 2D village view was retired in the
 * grid-retirement program (slices 1a/1b).
 *
 * It now handles:
 *   - OPEN_TEMPLE / CLOSE_TEMPLE, the still-live temple modal.
 *   - The town rumor mill (agora-049c). This reducer is the bridge between
 *     notable player deeds and the pure gossip engine in
 *     src/systems/intrigue/RumorMillSystem.ts. It needs no new action types:
 *     COMPLETE_QUEST and COMMIT_CRIME already cross the root reducer, and
 *     ADVANCE_TIME already ticks the day, so the mill is driven entirely off
 *     actions the shipped game dispatches today.
 *   - Reached building door state and append-only observed source records.
 *     These preserve physical evidence without granting access or replacing
 *     the current layout, household, contents or player position.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/11/2026, 01:29:05
 * Dependents: state/appState.ts
 * Imports: 20 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { GameState } from '../../types';
import { QuestStatus } from '../../types/quests';
import { AppAction } from '../actionTypes';
import { generateVillageTemple } from '../../utils/world';
import { VillagePersonality } from '../../types/village';
import { getGameDay } from '../../utils/core';
import { SeededRandom } from '../../utils/random';
import { resolveTownForLocation } from '../../systems/worldforge/townsim/chronicleForLocation';
import {bedsideStorageMoves, outsideLayoutRepairEnvelope, FURNITURE_REPAIR_RECIPE} from '../../systems/worldforge/interior/buildingLayoutRepair';
import {exteriorPropBaseline, replayExteriorPropRevisions, propDataSignature} from '../../systems/worldforge/props/exteriorPropRevision';
import {isGroundFootingSupported} from '../../components/World3D/groundBuildingMotion';
import {propSourceId} from '../../systems/worldforge/props/propSchema';
import {canonicalTownSeedPath} from '../../systems/worldforge/town/canonicalTown';
import {proposeHouseholdLivingPlan} from '../../systems/worldforge/interior/householdLivingPlan';
import {freezeHouseholdLayoutRevision,householdLayoutDoorStates} from '../../systems/worldforge/interior/householdLayoutRevision';
import {buildBuildingHistoryParts} from '../../systems/worldforge/bridge/buildingHistoryParts';
import {planGuestCirculation, guestCirculationDoorMoves, GUEST_CIRCULATION_RECIPE} from '../../systems/worldforge/interior/guestCirculation';
import { buildingPlanSignature, readObservedBuildingSource, observedBuildingSourceIsCurrent } from '../../systems/worldforge/interior/buildingSource';
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
    if (deed.id && (state.townRumors ?? []).some((candidate) => candidate.id === deed.id)) {
        return {};
    }
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
        case 'RETAIN_OBSERVED_BUILDING_SOURCE': {
            const source = action.payload, town = state.townSim?.[source.burgId];
            if (!town || !observedBuildingSourceIsCurrent(source, {
                worldSeed: state.worldSeed, cellId: state.playerCell?.cellId, position: state.playerGroundPos,
                historySignature: JSON.stringify(town.buildingEvents?.[source.plotId] ?? null),
                existing: town.buildingSources?.[source.plotId],
            })) return {};
            // Capture is append-only evidence. It changes no player, people,
            // contents, door/event state or current generated geometry.
            const retained = JSON.parse(JSON.stringify(source));
            return {townSim: {...state.townSim, [source.burgId]: {...town,
                buildingSources: {...town.buildingSources, [source.plotId]: retained},
            }}};
        }
        case 'ADMIT_BUILDING_LAYOUT_REPAIR': {
            const {burgId, plotId, sourceSignature} = action.payload;
            const town = state.townSim?.[burgId], source = town?.buildingSources?.[plotId], position = state.playerGroundPos;
            // A correction is separate from the immutable observation. Until
            // every party body's saved position has an admission contract, a
            // multi-person party waits rather than moving a companion by guess.
            if (!source || Object.keys(source.exteriorPropRevisions??{}).length || source.furnishingRepair || source.worldSeed !== state.worldSeed
                || source.burgId !== burgId || source.plotId !== plotId || source.planSignature !== sourceSignature
                || state.party.length !== 1 || state.playerCell?.cellId !== source.cellId || !position || position.yM === undefined
                || source.position.tileX !== position.tileX || source.position.tileY !== position.tileY
                || !outsideLayoutRepairEnvelope(source.plan, source.site, position)) return {};
            try { readObservedBuildingSource({worldSeed: state.worldSeed, burgId, source}, plotId, town?.buildingEvents?.[plotId]); }
            catch { return {}; }
            const moves = bedsideStorageMoves(source.plan);
            if (!moves.length) return {};
            const furnishingRepair = {version: 1 as const, recipe: FURNITURE_REPAIR_RECIPE, moves,
                admittedAt: new Date(state.gameTime).toISOString(), position: {...position, yM: position.yM}};
            // Original plan, household, manifests, doors, events and player XYZ
            // are preserved. Only this explicit recorded correction is appended.
            return {townSim: {...state.townSim, [burgId]: {...town!, buildingSources: {
                ...town!.buildingSources, [plotId]: {...source, furnishingRepair},
            }}}};
        }
        case 'ADMIT_GUEST_CIRCULATION_REPAIR': {
            const {burgId, plotId, sourceSignature, mountedSignature} = action.payload;
            const town = state.townSim?.[burgId], source = town?.buildingSources?.[plotId], position = state.playerGroundPos;
            if (!source || Object.keys(source.exteriorPropRevisions??{}).length || source.circulationRepair || source.planSignature !== sourceSignature
                || source.worldSeed !== state.worldSeed || source.burgId !== burgId || source.plotId !== plotId
                || state.party.length !== 1 || state.playerCell?.cellId !== source.cellId || !position || position.yM === undefined
                || source.position.tileX !== position.tileX || source.position.tileY !== position.tileY
                || !outsideLayoutRepairEnvelope(source.plan, source.site, position)) return {};
            let foundation;
            try { foundation = readObservedBuildingSource({worldSeed: state.worldSeed, burgId, source}, plotId, town?.buildingEvents?.[plotId]).plan; }
            catch { return {}; }
            if (buildingPlanSignature(foundation) !== mountedSignature) return {};
            const plan = planGuestCirculation(foundation, canonicalTownSeedPath(state.worldSeed, burgId));
            if (!plan) return {};
            // Resolve history through the production projector before storing a
            // structural correction. A valid reference alone does not prove the
            // renderer can draw its retained patch, roof repair or phase seam.
            try { buildBuildingHistoryParts(plan, 10 * 0.3048); } catch { return {}; }
            const doorMoves = guestCirculationDoorMoves(foundation, plan);
            const previousDoors = town?.buildingDoors?.[plotId], doors = {...previousDoors};
            for (const move of doorMoves) if (move.from !== move.to && previousDoors && Object.hasOwn(previousDoors, move.from)) {
                // Retain old qualified keys as history; a conflicting existing
                // destination cannot inherit another door's open/access state.
                if (Object.hasOwn(doors, move.to) && doors[move.to] !== previousDoors[move.from]) return {};
                doors[move.to] = previousDoors[move.from];
            }
            const circulationRepair = {version: 1 as const, recipe: GUEST_CIRCULATION_RECIPE, sourceSignature: mountedSignature,
                planSignature: buildingPlanSignature(plan), plan, doorMoves, admittedAt: new Date(state.gameTime).toISOString(),
                position: {...position, yM: position.yM}};
            // Only an explicit, reference-preserving revision and any required
            // door aliases change. People, goods, bookings and accepted feet stay.
            return {townSim: {...state.townSim, [burgId]: {...town!,
                buildingSources: {...town!.buildingSources, [plotId]: {...source, circulationRepair}},
                ...(previousDoors && JSON.stringify(previousDoors) !== JSON.stringify(doors)
                    ? {buildingDoors: {...town!.buildingDoors, [plotId]: doors}} : {}),
            }}};
        }
        case 'ADMIT_HOUSEHOLD_LAYOUT_REVISION': {
            const {burgId,plotId,sourceSignature,mountedSignature}=action.payload;
            const town=state.townSim?.[burgId],source=town?.buildingSources?.[plotId],position=state.playerGroundPos;
            // A known town revision and the exact mounted observed foundation
            // precede this separate building change. Unknown towns must finish
            // their owning source admission; a default is not historical proof.
            if(!source||Object.keys(source.exteriorPropRevisions??{}).length||source.householdRevision||source.circulationRepair||!source.household||source.workplaceOnly
                ||(town?.layoutRevision!==1&&town?.layoutRevision!==2)
                ||source.worldSeed!==state.worldSeed||source.burgId!==burgId||source.plotId!==plotId||source.planSignature!==sourceSignature
                ||state.party.length!==1||state.playerCell?.cellId!==source.cellId||!position||position.yM===undefined
                ||source.position.tileX!==position.tileX||source.position.tileY!==position.tileY
                ||!outsideLayoutRepairEnvelope(source.plan,source.site,position)
                ||JSON.stringify(town?.buildingEvents?.[plotId]??null)!==source.historySignature
                // A private cottage never repurposes a paid bed reference. A
                // future mixed home/inn revision needs its own reservation join.
                ||state.lodgingReservations?.some(stay=>stay.worldSeed===state.worldSeed&&stay.burgId===burgId&&stay.plotId===plotId))return {};
            try{
                const foundation=readObservedBuildingSource({worldSeed:state.worldSeed!,burgId,source},plotId,town?.buildingEvents?.[plotId]);
                if(buildingPlanSignature(foundation.plan)!==mountedSignature)return {};
                const proposal=proposeHouseholdLivingPlan(foundation.plan,canonicalTownSeedPath(state.worldSeed!,burgId));
                if(!proposal||proposal.recipe!=='shared-hall-cottage-v1'||proposal.issues.length)return {};
                const householdRevision=freezeHouseholdLayoutRevision(foundation.plan,foundation.household!,foundation.manifests,
                    proposal,new Date(state.gameTime).toISOString(),{...position,yM:position.yM});
                // Preflight the production history projector before persisting
                // the layout. Never relocate accepted feet to rescue a failure.
                buildBuildingHistoryParts(householdRevision.plan,3.048);
                const previous=town?.buildingDoors?.[plotId],doors=householdLayoutDoorStates(householdRevision,previous);
                return {townSim:{...state.townSim,[burgId]:{...town!,buildingSources:{...town!.buildingSources,[plotId]:{...source,householdRevision}},
                    ...(previous&&JSON.stringify(previous)!==JSON.stringify(doors)?{buildingDoors:{...town!.buildingDoors,[plotId]:doors}}:{})}}};
            }catch{return {};}
        }
        case 'ADMIT_EXTERIOR_PROP_REVISION': {
            try {
            const {receipt,ground}=action.payload, town=state.townSim?.[receipt.burgId], source=town?.buildingSources?.[receipt.plotId], position=state.playerGroundPos;
            if(!source||!position||position.yM===undefined||state.party.length!==1
                ||(town?.layoutRevision!==1&&town?.layoutRevision!==2)||state.worldSeed!==receipt.worldSeed
                ||state.playerCell?.cellId!==receipt.cellId||source.exteriorPropRevisions?.[propSourceId(receipt.original)]
                ||propDataSignature(state.party[0])!==receipt.characterSignature
                ||JSON.stringify(town.buildingEvents?.[receipt.plotId]??null)!==source.historySignature
                ||position.tileX!==receipt.position.tileX||position.tileY!==receipt.position.tileY
                ||Math.hypot(position.xM-receipt.position.xM,position.zM-receipt.position.zM,position.yM-receipt.position.yM)>.001
                ||Math.abs(Number(new Date(state.gameTime))-Date.parse(receipt.admittedAt))>2000
                ||!isGroundFootingSupported(ground,{...position,yM:position.yM},new Set())) return {};
                const existing=Object.fromEntries(Object.entries(state.townSim).map(([id,t])=>[id,t.buildingSources??{}]));
                const revised={...source,exteriorPropRevisions:{...source.exteriorPropRevisions,[propSourceId(receipt.original)]:receipt}};
                const next={...existing,[receipt.burgId]:{...existing[receipt.burgId],[receipt.plotId]:revised}};
                // Preflight production replay before accepting a save change. No
                // actor, manifest, permission, terrain or original source moves.
                const baseline=exteriorPropBaseline(ground,existing);
                replayExteriorPropRevisions(ground,baseline,next);
                return {townSim:{...state.townSim,[receipt.burgId]:{...town,buildingSources:{...town.buildingSources,[receipt.plotId]:revised}}}};
            } catch { return {}; }
        }
        case 'SET_TOWN_BUILDING_DOOR': {
            const { burgId, plotId, doorId, open } = action.payload;
            const town = state.townSim?.[burgId];
            // The physical interaction validates canonical geometry and reach.
            // Keep old saves safe and avoid manufacturing towns for a bad id.
            if (!town || !Number.isSafeInteger(burgId) || burgId < 0 || !Number.isSafeInteger(plotId) || plotId < 0
                || typeof open !== 'boolean' || !/^\d+:\d+:[xy]:-?\d+\.\d{4}:-?\d+\.\d{4}$/.test(doorId)) return {};
            if ((town.buildingDoors?.[plotId]?.[doorId] ?? false) === open) return {};
            return { townSim: { ...state.townSim, [burgId]: { ...town,
                buildingDoors: { ...town.buildingDoors, [plotId]: { ...town.buildingDoors?.[plotId], [doorId]: open } },
            } } };
        }
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
            // A quest that is already completed adds no duplicate deed.
            const quest = state.questLog.find((entry) => entry.id === action.payload.questId);
            if (!quest) return {};
            if (quest.status === QuestStatus.Completed || String(quest.status).toLowerCase() === 'completed') return {};
            return recordDeed(state, {
                id: `rumor_quest_${quest.id}`,
                kind: 'quest_completed',
                detail: quest.title,
            });
        }

        case 'UPDATE_QUEST_OBJECTIVE': {
            // When an objective update marks all objectives complete, the quest completes
            // and generates town gossip once per quest.
            const { questId, objectiveId, isCompleted } = action.payload;
            const quest = state.questLog.find((entry) => entry.id === questId);
            if (!quest) return {};
            if (quest.status === QuestStatus.Completed || String(quest.status).toLowerCase() === 'completed') return {};

            const objectiveIndex = quest.objectives.findIndex((o) => o.id === objectiveId);
            if (objectiveIndex === -1) return {};

            const updatedObjectives = quest.objectives.map((obj, idx) =>
                idx === objectiveIndex ? { ...obj, isCompleted } : obj,
            );
            const allObjectivesDone =
                updatedObjectives.length > 0 && updatedObjectives.every((obj) => obj.isCompleted);

            if (allObjectivesDone) {
                return recordDeed(state, {
                    id: `rumor_quest_${quest.id}`,
                    kind: 'quest_completed',
                    detail: quest.title,
                });
            }
            return {};
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
