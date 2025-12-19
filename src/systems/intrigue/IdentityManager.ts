/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intrigue/IdentityManager.ts
 * Manages player identity, disguises, and secret leverage.
 */

import { PlayerIdentityState, Secret, Identity, Disguise, Alias, IntrigueCheckResult } from '../../types/identity';
import { Faction, PlayerFactionStanding } from '../../types/factions';
import { SeededRandom } from '../../utils/seededRandom';
import { logger } from '../../utils/logger';

// Default DCs for spotting disguises based on observer role
// If specific stats are missing, we fallback to these.
const OBSERVER_PASSIVE_PERCEPTION_BY_ROLE: Record<string, number> = {
    'guard': 14,
    'merchant': 12,
    'noble': 13,
    'criminal': 14,
    'civilian': 10,
    'unique': 12
};

export class IdentityManager {

    /**
     * Creates the initial identity state for a new character.
     */
    static createInitialState(characterId: string, characterName: string, backgroundStory: string): PlayerIdentityState {
        const trueIdentity: Identity = {
            id: `id_${characterId}_true`,
            name: characterName,
            type: 'true',
            history: backgroundStory,
            fame: 0
        };

        return {
            characterId,
            trueIdentity,
            activeDisguise: null,
            currentPersonaId: trueIdentity.id,
            aliases: [],
            knownSecrets: [],
            exposedSecrets: []
        };
    }

    /**
     * Attempts to create a new alias.
     */
    static createAlias(currentState: PlayerIdentityState, name: string, history: string, region: string): PlayerIdentityState {
        const newAlias: Alias = {
            id: `alias_${Date.now()}`,
            name,
            type: 'alias',
            history,
            fame: 0,
            credibility: 50, // Base credibility
            establishedIn: [region]
        };

        return {
            ...currentState,
            aliases: [...currentState.aliases, newAlias]
        };
    }

    /**
     * Equips a disguise.
     */
    static equipDisguise(currentState: PlayerIdentityState, disguise: Disguise): PlayerIdentityState {
        return {
            ...currentState,
            activeDisguise: disguise,
            // When equipping a disguise, we initially assume it works
            currentPersonaId: `disguise_${disguise.id}`
        };
    }

    /**
     * Removes the active disguise.
     */
    static removeDisguise(currentState: PlayerIdentityState): PlayerIdentityState {
        return {
            ...currentState,
            activeDisguise: null,
            currentPersonaId: currentState.trueIdentity.id
        };
    }

    /**
     * Learns a new secret.
     */
    static learnSecret(currentState: PlayerIdentityState, secret: Secret): PlayerIdentityState {
        // Prevent duplicates
        if (currentState.knownSecrets.some(s => s.id === secret.id)) {
            return currentState;
        }
        return {
            ...currentState,
            knownSecrets: [...currentState.knownSecrets, secret]
        };
    }

    /**
     * Calculates the leverage value of a secret against a specific target.
     * This could be influenced by the target's personality or standing.
     */
    static calculateLeverage(secret: Secret, targetFactionId: string): number {
        // If the secret is ABOUT the target, it's high leverage (blackmail)
        if (secret.subjectId === targetFactionId) {
            return secret.value * 1.5; // Bonus for direct blackmail
        }

        // If the secret is about an ENEMY of the target, it's valuable trade goods
        // (Logic would require checking faction relationships, assumed passed in or handled higher up)

        return secret.value;
    }

    /**
     * Checks if a disguise holds up against an observer.
     *
     * @param disguise The active disguise.
     * @param observerRole Role of the observer (guard, merchant, etc.) to determine base DC.
     * @param situationalModifiers Bonuses or penalties to the check (e.g. +2 for distance, -5 for close inspection).
     * @param rng SeededRandom instance for deterministic checks (optional).
     */
    static checkDisguise(
        disguise: Disguise,
        observerRole: string = 'civilian',
        situationalModifiers: number = 0,
        rng?: SeededRandom
    ): IntrigueCheckResult {
        // 1. Determine Observer's Passive Perception DC
        const baseDC = OBSERVER_PASSIVE_PERCEPTION_BY_ROLE[observerRole] || 10;

        // 2. Determine Disguise Performance Roll
        // Roll = d20 + Disguise Quality
        const d20 = rng ? Math.floor(rng.next() * 20) + 1 : Math.floor(Math.random() * 20) + 1;
        const totalRoll = d20 + disguise.quality + situationalModifiers;

        const success = totalRoll >= baseDC;
        const margin = totalRoll - baseDC;

        logger.info('Disguise Check', {
            disguise: disguise.targetAppearance,
            quality: disguise.quality,
            roll: d20,
            total: totalRoll,
            dc: baseDC,
            success
        });

        const result: IntrigueCheckResult = {
            success,
            detected: !success,
            margin,
            consequences: []
        };

        if (!success) {
            result.consequences!.push('Disguise detected!');
            // Critical failure logic could go here (margin < -5)
            if (margin <= -5) {
                result.consequences!.push('Observer is immediately hostile or alerts guards.');
            }
        }

        return result;
    }
}
