/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/factionUtils.ts
 * Utility functions for managing faction reputation and standing.
 */

import { GameState } from '../types';
import { PlayerFactionStanding, FactionReputationChange } from '../types/factions';

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
