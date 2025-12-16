/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/identityUtils.ts
 * Utility functions for managing player identity, disguises, and aliases.
 */

import { v4 as uuidv4 } from 'uuid';
import {
    Alias,
    Disguise,
    DisguiseQuality,
    DisguiseCheckResult,
    PlayerIdentityState,
    DisguiseVulnerability
} from '../types/identity';
import { NPC } from '../types';

/**
 * Constants for Disguise DCs based on quality.
 */
export const DISGUISE_DCS: Record<DisguiseQuality, number> = {
    poor: 10,
    average: 13,
    good: 16,
    masterwork: 20,
    magical: 25,
};

/**
 * Creates a new Alias (persona) for the player.
 * @param name Name of the alias
 * @param background Backstory/cover for the alias
 */
export const createAlias = (name: string, background: string): Alias => {
    return {
        id: uuidv4(),
        name,
        background,
        reputation: {}, // Starts neutral with everyone
        isExposed: false,
        createdAt: Date.now(),
    };
};

/**
 * Creates a disguise object for a specific alias.
 */
export const createDisguise = (
    aliasId: string,
    quality: DisguiseQuality,
    visualDescription: string,
    vulnerabilities: DisguiseVulnerability[] = []
): Disguise => {
    return {
        id: uuidv4(),
        aliasId,
        quality,
        visualDescription,
        vulnerabilities,
        timeDonned: Date.now(),
    };
};

/**
 * Calculates the DC for an NPC to spot the disguise.
 * @param disguise The disguise being worn
 * @param situationModifiers Situational modifiers (e.g., -5 for 'being interrogated', +5 for 'darkness')
 */
export const calculateDisguiseDC = (disguise: Disguise, situationModifiers: number = 0): number => {
    let dc = DISGUISE_DCS[disguise.quality];

    // Apply situation modifiers
    dc += situationModifiers;

    return dc;
};

/**
 * Simulates a d20 roll for ability checks.
 */
const d20 = () => Math.floor(Math.random() * 20) + 1;

/**
 * Determines if an NPC spots through the player's disguise.
 * This should be called when interacting with an NPC while disguised.
 *
 * @param player The player character (for Deception bonus, if we had stats passed in, currently simplified)
 * @param npc The NPC observing the player
 * @param disguise The active disguise
 * @param triggeringAction The action causing the check (to trigger vulnerabilities)
 */
export const attemptDisguiseCheck = (
    npc: NPC,
    disguise: Disguise,
    triggeringAction?: 'speech' | 'combat' | 'magic' | 'inspection'
): DisguiseCheckResult => {
    // 1. Determine DC
    const dc = calculateDisguiseDC(disguise);

    // 2. NPC Rolls Insight/Perception
    // Since NPC stats are not fully defined in the simple NPC interface, we'll assume a baseline
    // and potentially use 'role' to estimate bonuses.
    let npcBonus = 0;
    if (npc.role === 'guard') npcBonus += 2;
    if (npc.role === 'merchant') npcBonus += 3; // Good at reading people
    if (npc.role === 'unique') npcBonus += 4; // Bosses/Important NPCs are sharper

    // Add vulnerability bonus if applicable
    if (triggeringAction) {
        const vuln = disguise.vulnerabilities.find(v => v.trigger === triggeringAction);
        if (vuln) {
            npcBonus += vuln.detectionBonus;
        }
    }

    const roll = d20();
    const total = roll + npcBonus;
    const success = total < dc; // Success means Disguise holds (NPC failed to beat DC)

    return {
        success,
        detectedBy: success ? [] : [npc.id],
        roll: total,
        dc,
        consequences: success ? [] : [`Detected by ${npc.name}`]
    };
};

/**
 * Helper to initialize the identity state if it doesn't exist.
 */
export const getInitialIdentityState = (): PlayerIdentityState => {
    return {
        currentIdentityId: 'true_self',
        aliases: [],
        activeDisguise: null,
        knownTo: {},
    };
};

/**
 * Records that an NPC has discovered the player's identity (true or specific alias).
 */
export const recordDiscovery = (
    state: PlayerIdentityState,
    npcId: string,
    identityId: string
): PlayerIdentityState => {
    const knownList = state.knownTo[npcId] || [];
    if (knownList.includes(identityId)) return state;

    return {
        ...state,
        knownTo: {
            ...state.knownTo,
            [npcId]: [...knownList, identityId]
        }
    };
};
