// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 26/01/2026, 01:40:31
 * Dependents: factionUtils.ts, world/index.ts
 * Imports: 5 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/factionUtils.ts
 * Utility functions for managing faction reputation and standing.
 */

import { GameState, GameMessage } from '../../types';
import { PlayerFactionStanding, Faction, ReputationEvent } from '../../types/factions';
import { FACTIONS } from '../../data/factions';
import { generateRegionalPolitics } from './nobleHouseGenerator';
import { v4 as uuidv4 } from 'uuid';
import { getGameDay } from '../core/timeUtils';

export type ReputationTier = 'NEMESIS' | 'HOSTILE' | 'UNFRIENDLY' | 'NEUTRAL' | 'FRIENDLY' | 'HONORED' | 'REVERED';

export const REPUTATION_THRESHOLDS: Record<ReputationTier, { min: number; max: number }> = {
    NEMESIS: { min: -100, max: -80 },
    HOSTILE: { min: -79, max: -40 },
    UNFRIENDLY: { min: -39, max: -10 },
    NEUTRAL: { min: -9, max: 9 },
    FRIENDLY: { min: 10, max: 39 },
    HONORED: { min: 40, max: 79 },
    REVERED: { min: 80, max: 100 },
};

export const getReputationTier = (standing: number): ReputationTier => {
    if (standing <= REPUTATION_THRESHOLDS.NEMESIS.max) return 'NEMESIS';
    if (standing <= REPUTATION_THRESHOLDS.HOSTILE.max) return 'HOSTILE';
    if (standing <= REPUTATION_THRESHOLDS.UNFRIENDLY.max) return 'UNFRIENDLY';
    if (standing <= REPUTATION_THRESHOLDS.NEUTRAL.max) return 'NEUTRAL';
    if (standing <= REPUTATION_THRESHOLDS.FRIENDLY.max) return 'FRIENDLY';
    if (standing <= REPUTATION_THRESHOLDS.HONORED.max) return 'HONORED';
    return 'REVERED';
};

/**
 * Initializes relationships for a faction based on its static allies/enemies lists.
 */
const initializeRelationships = (faction: Faction, allFactions: Record<string, Faction>): Record<string, number> => {
    const relationships: Record<string, number> = {};

    // Default everything to 0 first (implicit)

    // Set Allies
    faction.allies.forEach(id => {
        if (allFactions[id]) relationships[id] = 60; // Friendly
    });

    // Set Enemies
    faction.enemies.forEach(id => {
        if (allFactions[id]) relationships[id] = -60; // Hostile
    });

    // Set Rivals
    faction.rivals.forEach(id => {
        if (allFactions[id]) relationships[id] = -20; // Unfriendly
    });

    return relationships;
};

/**
 * Retrieves the full list of factions, including static and procedurally generated ones.
 * Cached to ensure stability if called multiple times with same seed.
 */
let cachedFactions: Record<string, Faction> | null = null;
let cachedSeed: number | null = null;

export const getAllFactions = (worldSeed: number = 0): Record<string, Faction> => {
    if (cachedFactions && cachedSeed === worldSeed) {
        return cachedFactions;
    }

    // 1. Start with static factions (DEEP CLONE to avoid mutating global constant)
    const allFactions: Record<string, Faction> = JSON.parse(JSON.stringify(FACTIONS));

    // 2. Generate procedural noble houses
    // We'll generate 5 random noble houses to populate the political landscape
    const nobleHouses = generateRegionalPolitics(worldSeed, 5);

    nobleHouses.forEach(house => {
        allFactions[house.id] = house;
    });

    // 3. Initialize dynamic relationships for all factions
    // We do this after all factions are present so we can validate IDs if needed
    // (though logic below mainly uses ID strings)
    Object.values(allFactions).forEach(faction => {
        // Only initialize if empty (static data comes with empty object)
        if (Object.keys(faction.relationships).length === 0) {
            faction.relationships = initializeRelationships(faction, allFactions);
        }
    });

    cachedFactions = allFactions;
    cachedSeed = worldSeed;

    return allFactions;
};

/**
 * Gets the player's standing with a faction.
 * If 'secretly' is true, returns the true standing.
 * If false, returns the public standing (what they show).
 */
export const getFactionStanding = (
    state: GameState,
    factionId: string,
    secretly: boolean = false
): number => {
    const standing = state.playerFactionStandings[factionId];
    if (!standing) return 0; // Default to neutral if unknown
    return secretly ? standing.secretStanding : standing.publicStanding;
};

/**
 * Calculates the new standing value, clamped between -100 and 100.
 */
export const calculateNewStanding = (current: number, change: number): number => {
    return Math.max(-100, Math.min(100, current + change));
};

/**
 * Generates a log message for a reputation change.
 */
export const formatReputationChangeMessage = (
    factionName: string,
    change: number,
    type: 'public' | 'secret',
    reason?: string
): string => {
    const verb = change > 0 ? 'improved' : 'worsened';
    const amountStr = Math.abs(change).toString();
    const typeStr = type === 'secret' ? 'Secretly' : 'Publicly';
    const reasonStr = reason ? ` due to ${reason}` : '';

    return `${typeStr}, your standing with ${factionName} has ${verb} by ${amountStr}${reasonStr}.`;
};

interface RippleEffect {
    factionId: string;
    amount: number;
    reason: string;
}

/**
 * Calculates secondary reputation changes based on alliances and rivalries.
 *
 * Rules:
 * - Allies gain 50% of positive changes.
 * - Allies gain 50% of negative changes (they dislike you for hurting their friend).
 * - Enemies gain 50% of negative changes (they like you for hurting their enemy).
 * - Enemies lose 50% of positive changes (they dislike you for helping their enemy).
 * - Rivals lose 25% of positive changes (jealousy).
 * - Rivals gain 25% of negative changes (schadenfreude).
 */
export const calculateRippleEffects = (
    factions: Record<string, Faction>,
    primaryFactionId: string,
    amount: number
): RippleEffect[] => {
    const ripples: RippleEffect[] = [];
    const primaryFaction = factions[primaryFactionId];
    if (!primaryFaction) return ripples;

    // Apply to allies
    primaryFaction.allies.forEach(allyId => {
        if (factions[allyId]) {
            // Allies care about what you do to their friends
            // If amount > 0 (helped friend), ally +50%
            // If amount < 0 (hurt friend), ally -50%
            const rippleAmount = Math.round(amount * 0.5);
            if (rippleAmount !== 0) {
                ripples.push({
                    factionId: allyId,
                    amount: rippleAmount,
                    reason: amount > 0
                        ? `alliance with ${primaryFaction.name}`
                        : `harm done to ally ${primaryFaction.name}`
                });
            }
        }
    });

    // Apply to enemies
    primaryFaction.enemies.forEach(enemyId => {
        if (factions[enemyId]) {
            // Enemies react inversely
            // If amount > 0 (helped enemy), enemy -50%
            // If amount < 0 (hurt enemy), enemy +50%
            const rippleAmount = Math.round(amount * -0.5);
            if (rippleAmount !== 0) {
                ripples.push({
                    factionId: enemyId,
                    amount: rippleAmount,
                    reason: amount > 0
                        ? `support for enemy ${primaryFaction.name}`
                        : `opposition to enemy ${primaryFaction.name}`
                });
            }
        }
    });

    // Apply to rivals
    primaryFaction.rivals.forEach(rivalId => {
        if (factions[rivalId]) {
            // Rivals are petty competitors
            // If amount > 0 (helped rival), rival -25% (jealousy)
            // If amount < 0 (hurt rival), rival +25% (schadenfreude)
            const rippleAmount = Math.round(amount * -0.25);
            if (rippleAmount !== 0) {
                ripples.push({
                    factionId: rivalId,
                    amount: rippleAmount,
                    reason: amount > 0
                        ? `rivalry with ${primaryFaction.name}`
                        : `misfortune of rival ${primaryFaction.name}`
                });
            }
        }
    });

    return ripples;
};

/**
 * @deprecated Use FactionManager.applyReputationChange instead.
 * This utility function is kept for backward compatibility but does not generate rumors.
 */
interface ApplyReputationResult {
    standings: Record<string, PlayerFactionStanding>;
    logs: GameMessage[];
}

/**
 * Applies a reputation change and all its ripple effects.
 * Returns updated standings map and generated log messages.
 * Does NOT mutate the input state.
 *
 * @deprecated Use FactionManager.applyReputationChange() for full feature support (rumors).
 */
export const applyReputationChange = (
    state: GameState,
    factionId: string,
    amount: number,
    reason: string
): ApplyReputationResult => {
    // Clone standings to avoid mutation
    const newStandings = { ...state.playerFactionStandings };
    const logs: GameMessage[] = [];
    const timestamp = new Date(); // Use current time for log generation

    // Helper to apply change
    const applyToFaction = (fId: string, amt: number, rsn: string) => {
        if (!newStandings[fId]) {
             // Initialize if missing (should exist from game start, but safe fallback)
             newStandings[fId] = {
                 factionId: fId,
                 publicStanding: 0,
                 secretStanding: 0,
                 rankId: 'outsider',
                 favorsOwed: 0,
                 renown: 0,
                 history: []
             };
        }

        const current = newStandings[fId];
        const oldStanding = current.publicStanding;
        const newStanding = calculateNewStanding(oldStanding, amt);

        // Record history event
        const historyEvent: ReputationEvent = {
            id: uuidv4(),
            timestamp: getGameDay(state.gameTime), // Use game day or raw timestamp? Using GameDay for consistency with other systems
            change: amt,
            newStanding: newStanding,
            reason: rsn,
            source: 'system' // Could be passed in if needed
        };

        // Update state
        // Cap history at 50 events to prevent infinite growth (Recorder principle: "Forgetting is as important as remembering")
        const currentHistory = current.history || [];
        const newHistory = [...currentHistory, historyEvent].slice(-50);

        newStandings[fId] = {
            ...current,
            publicStanding: newStanding,
            secretStanding: calculateNewStanding(current.secretStanding, amt), // Assume secret moves with public for now
            history: newHistory
        };

        // Log if visible change
        if (amt !== 0) {
            const factionName = state.factions[fId]?.name || fId;
            logs.push({
                id: Date.now() + Math.random(), // Simple ID generation
                text: formatReputationChangeMessage(factionName, amt, 'public', rsn),
                sender: 'system',
                timestamp: timestamp
            });
        }
    };

    // 1. Apply primary change
    applyToFaction(factionId, amount, reason);

    // 2. Calculate and apply ripples
    const ripples = calculateRippleEffects(state.factions, factionId, amount);
    ripples.forEach(ripple => {
        applyToFaction(ripple.factionId, ripple.amount, ripple.reason);
    });

    return { standings: newStandings, logs };
};

/**
 * Modifies the standing between two factions.
 * Returns the new standing value.
 * Does NOT mutate the faction objects, but assumes you will update state with the return value.
 * (Actually, to be safe, this should probably return the modified Faction objects or similar)
 *
 * For now, simpler to just return the new value and let caller handle object spread.
 */
export const modifyFactionRelationship = (
    factions: Record<string, Faction>,
    actorId: string,
    targetId: string,
    amount: number
): { actor: Faction, target: Faction } | null => {
    const actor = factions[actorId];
    const target = factions[targetId];

    if (!actor || !target) return null;

    // We assume relationships are symmetric for now (if I hate you, you probably hate me)
    // But technically the structure supports asymmetry.
    // Let's implement ASYMMETRIC updates (A changes opinion of B).
    // The caller can call this twice if they want symmetry.

    // WAIT: If I change opinion, I need to update the actor object.

    const currentStanding = actor.relationships[targetId] || 0;
    const newStanding = calculateNewStanding(currentStanding, amount);

    // Return a new Actor object with updated relationships
    const newActor = {
        ...actor,
        relationships: {
            ...actor.relationships,
            [targetId]: newStanding
        }
    };

    return { actor: newActor, target }; // Target unchanged in this op
};
