/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intrigue/TavernGossipSystem.ts
 * Manages the generation and purchase of rumors and secrets in taverns.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 16:22:54
 * Dependents: components/Town/Intrigue/RumorMill.tsx
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { GameState, WorldRumor } from '../../types';
import { ItemType } from '../../types';
import { Secret } from '../../types/identity';
import { SecretGenerator } from './SecretGenerator';
import { getGameDay } from '../../utils/core';
import { SeededRandom } from '@/utils/random';
import { isRumorStale, townRumorToWorldRumor } from './RumorMillSystem';
import { burgIdForLocation } from '../worldforge/townsim/chronicleForLocation';
import { townNewsContext } from '../worldforge/townsim/townNews';
import { companionActivityRumors } from '../companions/companionWorldActivities';

export interface PurchaseableRumor {
    id: string;
    type: 'rumor' | 'secret' | 'lead';
    cost: number;
    title: string; // The "hook" text shown before buying
    content?: string; // The actual info (hidden until bought)
    payload?: WorldRumor | Secret; // The data object to add to state
    /** Quest a 'lead' points at. Buying the lead accepts this quest. */
    questId?: string;
    /** Verified public subject and event age, safe to show before buying details. */
    context?: { subject: string; ageLabel: string };
}

/** The PurchaseableRumor id a WorldRumor is offered under. */
function gossipOfferId(rumorId: string): string {
    return `gossip_${rumorId}`;
}

/**
 * Every gossip offer the player has already bought (agora-5454).
 *
 * A purchase leaves a Service item in the inventory whose `sourceId` is the offer id
 * it came from (see RumorMill.handlePurchase). That receipt IS the player's
 * rumor knowledge: it is durable, it is already saved with the inventory, and it
 * survives closing the modal. No second store is needed to answer "have I heard
 * this?".
 */
function heardOfferIds(state: GameState): Set<string> {
    const heard = new Set<string>();
    for (const item of state.inventory ?? []) {
        if (item.type === ItemType.Service && item.sourceId) heard.add(item.sourceId);
    }
    return heard;
}

/** Check the retained local chronicle before dating or categorizing an account.
 * An id prefix alone cannot certify changed words, dates or another town's news.
 * This adds display context only; it never changes a rumor or an owned receipt. */
export function chronicleRumorContext(state: GameState, rumor: WorldRumor): PurchaseableRumor['context'] {
    if (!rumor.id.startsWith('chronicle-') || rumor.locationId !== state.currentLocationId
        || !state.townSim || !Object.keys(state.townSim).length || !Number.isFinite(state.worldSeed)
        || !(state.gameTime instanceof Date) || !Number.isFinite(state.gameTime.getTime())) return undefined;
    const burgId = burgIdForLocation({ground:state, worldSeed:state.worldSeed, cellId:state.playerCell?.cellId});
    const town = burgId === undefined ? undefined : state.townSim[burgId];
    const matches = town?.chronicle?.events.filter(event => rumor.id === 'chronicle-'+state.currentLocationId+'-'+event.id) ?? [];
    const event = matches.length === 1 ? matches[0] : undefined;
    const day = getGameDay(state.gameTime);
    if (!town || !event || event.summary !== rumor.text || event.day !== rumor.timestamp
        || !Number.isInteger(event.day) || !Number.isInteger(day) || event.day > day) return undefined;
    const family = ['marriage','birth','death','courtship','came_of_age','inheritance'];
    const subject = family.includes(event.kind) ? 'Family news'
        : event.kind === 'economy' ? 'Trade news' : 'Town news';
    const {ageLabel} = townNewsContext(town,{id:event.id,day:event.day,kind:event.kind,text:event.summary,prominence:'notice'},day);
    return {subject,ageLabel};
}

export class TavernGossipSystem {

    /**
     * Generates a list of rumors available for purchase at a specific location/time.
     * Deterministic based on game seed + time + location, so it persists for the day.
     */
    static getAvailableRumors(state: GameState, locationId: string = 'global'): PurchaseableRumor[] {
        const day = getGameDay(state.gameTime);
        const seed = state.worldSeed + day + (locationId.split('').reduce((a,b)=>a+b.charCodeAt(0),0));
        const rng = new SeededRandom(seed);

        const rumors: PurchaseableRumor[] = [];

        // 1. Cheap Gossip (World Rumors)
        // The pool is faction/world news (activeRumors) plus the town's own talk
        // about the player's deeds, which the rumor mill has spread far enough
        // that a barkeep could plausibly have picked it up (agora-049c).
        // Location-bound news is offered where it is active. Unlocated world
        // news remains available; saved news from a previous town is not local.
        const activeRumors = (state.activeRumors || [])
            .filter(rumor => !rumor.locationId || rumor.locationId === state.currentLocationId)
            .filter(rumor => rumor.expiration >= day);
        const townTalk = (state.townRumors ?? [])
            // Talk belongs to the town it happened in.
            .filter((rumor) => rumor.locationId === state.currentLocationId)
            // The witness alone is not gossip yet; it is gossip once it has been retold.
            .filter((rumor) => rumor.reachedNpcs.length > 1)
            .filter((rumor) => !isRumorStale(rumor, day))
            .map(townRumorToWorldRumor);

        // Already-heard rumors are not offered again: the barkeep does not sell
        // you back the thing you paid them for yesterday. What you bought is
        // still readable on the receipt in your inventory.
        const heard = heardOfferIds(state);
        const unknownRumors = [...activeRumors, ...townTalk].filter(
            (rumor) => !heard.has(gossipOfferId(rumor.id)),
        );

        // Dungeon legends have their own inquiry below. Ordinary news must not
        // bury a real nearby adventure behind repeated blind gossip purchases.
        const localLegends = unknownRumors.filter(rumor => rumor.id.startsWith('dungeon-'));
        const news = unknownRumors.filter(rumor => !rumor.id.startsWith('dungeon-'));
        if (news.length > 0) {
            const picked = rng.pick(news);
            const context = chronicleRumorContext(state, picked);
            rumors.push({
                id: gossipOfferId(picked.id),
                type: 'rumor',
                cost: 2 + Math.floor(rng.next() * 5), // 2-6 gp
                // Historical town accounts remain available, with their age and
                // subject visible before payment. Their private details stay hidden.
                title: context ? context.subject+' · '+context.ageLabel
                    : picked.id.startsWith('chronicle-') ? 'Town account · date unverified' : 'Ask about local news',
                ...(context ? {context} : {}),
                content: picked.text,
                payload: picked
            });
        }

        // Always have a "Local Rumor" option if no world rumors match
        if (rumors.length === 0) {
             rumors.push({
                id: `gossip_generic_${day}_${Math.floor(rng.next() * 1000)}`,
                type: 'rumor',
                cost: 2,
                title: "Hear the latest gossip",
                content: "Not much happening around here lately...",
                payload: undefined
            });
        }

        // 2. Juicy Secrets (Faction Intel)
        // 30% chance to have a secret available
        if (rng.next() < 0.3) {
            const secretGen = new SecretGenerator(seed);
            const factions = Object.values(state.factions);
            const secret = secretGen.generateRandomSecret(factions);

            if (secret) {
                rumors.push({
                    id: `secret_${secret.id}`,
                    type: 'secret',
                    cost: 50 + Math.floor(rng.next() * 50), // 50-100 gp
                    title: "Buy a valuable secret",
                    content: secret.content,
                    payload: secret
                });
            }
        }

        // The old random offer sold a northward ruin without a source, then
        // accepted the separate eastern legacy quest. Keep that authored quest
        // and its real item hooks; sell only the sourced accounts below here.
        // Consume the old chance/price rolls so existing local account choices
        // and posted prices do not change just because this offer is withdrawn.
        if (rng.next() < 0.2) rng.next();

        // The sync supplies only hooks within the source dungeon's own earshot.
        // Sell that exact hook and retain its source ID on the normal receipt;
        // no fabricated location, quest or undiscovered map marker is added.
        if (localLegends.length > 0) {
            const picked = rng.pick(localLegends);
            rumors.push({
                id: gossipOfferId(picked.id),
                type: 'rumor',
                cost: 2 + Math.floor(rng.next() * 5),
                title: 'Ask about local ruins and dangers',
                content: picked.text,
                payload: picked,
            });
        }

        // Public work supplies a concrete local lead through the ordinary paid
        // receipt. It grants neither a meeting nor a personal quest acceptance.
        for(const rumor of companionActivityRumors(state,day)){
            if(!heard.has(gossipOfferId(rumor.id)))rumors.push({
                id:gossipOfferId(rumor.id),type:'rumor',cost:2,
                title:'Ask about a local adventurer',content:rumor.text,payload:rumor,
            });
        }
        return rumors;
    }
}
