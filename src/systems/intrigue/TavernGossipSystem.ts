/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intrigue/TavernGossipSystem.ts
 * Manages the generation and purchase of rumors and secrets in taverns.
 */

import { GameState, WorldRumor } from '../../types';
import { Secret } from '../../types/identity';
import { SecretGenerator } from './SecretGenerator';
import { getGameDay } from '../../utils/timeUtils';
import { SeededRandom } from '../../utils/seededRandom';

export interface PurchaseableRumor {
    id: string;
    type: 'rumor' | 'secret' | 'lead';
    cost: number;
    title: string; // The "hook" text shown before buying
    content?: string; // The actual info (hidden until bought)
    payload?: WorldRumor | Secret; // The data object to add to state
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
        // Check active world rumors first
        const activeRumors = state.activeRumors || [];
        const unknownRumors = activeRumors.filter(r =>
            // Filter logic could go here, e.g., haven't heard it yet
            // For now, just pick random ones from the world state
            true
        );

        if (unknownRumors.length > 0) {
            const picked = rng.pick(unknownRumors);
            rumors.push({
                id: `gossip_${picked.id}`,
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
                // TODO(Intriguer): Connect this to the Quest Generation system to spawn a real Quest object.
                payload: undefined
            });
        }

        return rumors;
    }
}
