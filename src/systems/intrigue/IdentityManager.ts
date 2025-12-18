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
            activeDisguise: disguise
        };
    }

    /**
     * Removes the active disguise.
     */
    static removeDisguise(currentState: PlayerIdentityState): PlayerIdentityState {
        return {
            ...currentState,
            activeDisguise: null
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
}
