/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intrigue/TavernGossipSystem.ts
 * Manages the generation and purchase of rumors and secrets in taverns.
 */

import { GameState, WorldRumor } from '../../types';
import { ItemType } from '../../types';
import { Secret } from '../../types/identity';
import { SecretGenerator } from './SecretGenerator';
import { getGameDay } from '../../utils/core';
import { SeededRandom } from '@/utils/random';
import { isRumorStale, townRumorToWorldRumor } from './RumorMillSystem';

export interface PurchaseableRumor {
    id: string;
    type: 'rumor' | 'secret' | 'lead';
    cost: number;
    title: string; // The "hook" text shown before buying
    content?: string; // The actual info (hidden until bought)
    payload?: WorldRumor | Secret; // The data object to add to state
    /** Quest a 'lead' points at. Buying the lead accepts this quest. */
    questId?: string;
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
        const activeRumors = state.activeRumors || [];
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

        if (unknownRumors.length > 0) {
            const picked = rng.pick(unknownRumors);
            rumors.push({
                id: gossipOfferId(picked.id),
                type: 'rumor',
                cost: 2 + Math.floor(rng.next() * 5), // 2-6 gp
                title: "Hear the latest gossip",
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

        // 3. Adventure Lead (Hook)
        // 20% chance
        if (rng.next() < 0.2) {
             rumors.push({
                id: `lead_${day}`,
                type: 'lead',
                cost: 10 + Math.floor(rng.next() * 10),
                title: "Ask about work or trouble",
                content: "I heard there's an old ruin to the north that's been glowing at night.",
                payload: undefined,
                questId: 'explore_ruins'
            });
        }

        return rumors;
    }
}
