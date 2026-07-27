/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intrigue/IdentityManager.ts
 * Manages player identity, disguises, and secret leverage.
 */
import { PlayerIdentityState, Secret, Disguise } from '../../types/identity';
export declare class IdentityManager {
    /**
     * Creates the initial identity state for a new character.
     */
    static createInitialState(characterId: string, characterName: string, backgroundStory: string): PlayerIdentityState;
    /**
     * Attempts to create a new alias.
     */
    static createAlias(currentState: PlayerIdentityState, name: string, history: string, region: string): PlayerIdentityState;
    /**
     * Equips a disguise.
     */
    static equipDisguise(currentState: PlayerIdentityState, disguise: Disguise): PlayerIdentityState;
    /**
     * Removes the active disguise.
     */
    static removeDisguise(currentState: PlayerIdentityState): PlayerIdentityState;
    /**
     * Learns a new secret.
     */
    static learnSecret(currentState: PlayerIdentityState, secret: Secret): PlayerIdentityState;
    /**
     * Calculates the leverage value of a secret against a specific target.
     * This could be influenced by the target's personality or standing.
     */
    static calculateLeverage(secret: Secret, targetFactionId: string): number;
}
