/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/factionUtils.ts
 * Utility functions for managing faction reputation and standing.
 */

import { GameState } from '../types';
import { PlayerFactionStanding, FactionReputationChange, Faction } from '../types/factions';
import { GameMessage } from '../types';

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

interface ApplyReputationResult {
    standings: Record<string, PlayerFactionStanding>;
    logs: GameMessage[];
}

/**
 * Applies a reputation change and all its ripple effects.
 * Returns updated standings map and generated log messages.
 * Does NOT mutate the input state.
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
    const applyToFaction = (fId: string, amt: number, rsn: string, isRipple: boolean) => {
        if (!newStandings[fId]) {
             // Initialize if missing (should exist from game start, but safe fallback)
             newStandings[fId] = {
                 factionId: fId,
                 publicStanding: 0,
                 secretStanding: 0,
                 rankId: 'outsider',
                 favorsOwed: 0,
                 renown: 0
             };
        }

        const current = newStandings[fId];
        const oldStanding = current.publicStanding;
        const newStanding = calculateNewStanding(oldStanding, amt);

        // Update state
        newStandings[fId] = {
            ...current,
            publicStanding: newStanding,
            secretStanding: calculateNewStanding(current.secretStanding, amt) // Assume secret moves with public for now
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
    applyToFaction(factionId, amount, reason, false);

    // 2. Calculate and apply ripples
    const ripples = calculateRippleEffects(state.factions, factionId, amount);
    ripples.forEach(ripple => {
        applyToFaction(ripple.factionId, ripple.amount, ripple.reason, true);
    });

    return { standings: newStandings, logs };
};
