/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/identityService.ts
 * Service for managing player identity, aliases, disguises, and secrets.
 */

import { Alias, Disguise, Identity, PlayerIdentityState, Secret } from '../types/identity';
import { PlayerFactionStanding } from '../types/factions';
import { INITIAL_FACTION_STANDINGS } from '../data/factions';
import { logger } from '../utils/logger';

/**
 * Creates a new alias with default initial standings.
 */
export const createAlias = (
    id: string,
    name: string,
    history: string,
    initialCredibility: number = 50,
    establishedIn: string[] = []
): Alias => {
    return {
        id,
        name,
        type: 'alias',
        history,
        fame: 0,
        credibility: initialCredibility,
        establishedIn,
        standings: {} // Aliases start as unknown strangers (0 standing) unless specified otherwise
    };
};

/**
 * Switches the active persona.
 * Note: This does not enforce disguise requirements directly.
 * Use `calculateDetectionRisk` to determine if the switch is risky or effective.
 */
export const switchToPersona = (
    state: PlayerIdentityState,
    targetPersonaId: string
): PlayerIdentityState => {
    // Validate existence
    const isTrueIdentity = targetPersonaId === state.trueIdentity.id;
    const alias = state.aliases.find(a => a.id === targetPersonaId);

    if (!isTrueIdentity && !alias) {
        logger.warn(`Attempted to switch to non-existent persona: ${targetPersonaId}`);
        return state;
    }

    return {
        ...state,
        currentPersonaId: targetPersonaId
    };
};

/**
 * Calculates the chance (0.0 to 1.0) of a persona being detected as false.
 * Higher score = Higher risk of exposure.
 *
 * @param state The current identity state
 * @param observerPerception Optional modifier for observer's skill (default 0)
 */
export const calculateDetectionRisk = (state: PlayerIdentityState, observerPerception: number = 0): number => {
    const currentIdentity = getCurrentIdentity(state);

    // True Identity is never "fake", so risk is 0 (unless we mean risk of being recognized as famous, which is different)
    if (currentIdentity.type === 'true') {
        return 0.0;
    }

    const alias = currentIdentity as Alias;
    let risk = 0.5; // Base risk for any lie

    // 1. Alias Credibility Factor (Higher Credibility = Lower Risk)
    // 100 credibility -> -0.4 risk reduction
    // 0 credibility -> 0 reduction
    risk -= (alias.credibility / 100) * 0.4;

    // 2. Disguise Factor
    if (state.activeDisguise) {
        // High quality disguise reduces risk significantly
        // Quality 20 (DC 20) -> -0.4 risk
        risk -= (state.activeDisguise.quality / 50);

        // If disguise name explicitly matches alias name, bonus reduction
        if (state.activeDisguise.targetAppearance.toLowerCase().includes(alias.name.toLowerCase())) {
            risk -= 0.1;
        }
    } else {
        // No disguise while using an alias? Huge risk!
        // Unless the alias is "just me but with a fake name", which relies purely on acting (credibility).
        risk += 0.3;
    }

    // 3. Observer Factor
    risk += (observerPerception * 0.05);

    // Clamp between 0 and 1
    return Math.max(0.0, Math.min(1.0, risk));
};

/**
 * Dons a physical disguise.
 */
export const donDisguise = (
    state: PlayerIdentityState,
    disguise: Disguise
): PlayerIdentityState => {
    return {
        ...state,
        activeDisguise: disguise
    };
};

/**
 * Doffs (removes) the current disguise.
 * This might force a persona switch back to true identity if the current alias relied on it.
 */
export const doffDisguise = (state: PlayerIdentityState): PlayerIdentityState => {
    // If we were using an alias, we might be exposed now, but strictly speaking
    // removing the wig doesn't change who you *claim* to be, just how convincing it is.
    // However, usually you drop the persona when you drop the disguise.

    // For now, we just remove the disguise.
    return {
        ...state,
        activeDisguise: null
    };
};

/**
 * Gets the full Identity object for the currently active persona.
 */
export const getCurrentIdentity = (state: PlayerIdentityState): Identity => {
    if (state.currentPersonaId === state.trueIdentity.id) {
        return state.trueIdentity;
    }
    const alias = state.aliases.find(a => a.id === state.currentPersonaId);
    return alias || state.trueIdentity; // Fallback to true identity if alias missing
};

/**
 * Helper to get the reputation map for the current persona.
 * Note: This returns a read-only view. Updates must go through state reducers.
 */
export const getCurrentStandings = (
    state: PlayerIdentityState,
    globalPlayerStandings: Record<string, PlayerFactionStanding>
): Record<string, PlayerFactionStanding> => {
    if (state.currentPersonaId === state.trueIdentity.id) {
        return globalPlayerStandings;
    }
    const alias = state.aliases.find(a => a.id === state.currentPersonaId);
    return alias ? alias.standings : globalPlayerStandings;
};

/**
 * Adds a secret to the player's knowledge base.
 */
export const learnSecret = (state: PlayerIdentityState, secret: Secret): PlayerIdentityState => {
    if (state.knownSecrets.some(s => s.id === secret.id)) {
        return state;
    }
    return {
        ...state,
        knownSecrets: [...state.knownSecrets, secret]
    };
};

/**
 * Reveals a secret to a target (adds target ID to knownBy).
 * Returns updated secret and state.
 */
export const revealSecretTo = (
    state: PlayerIdentityState,
    secretId: string,
    targetEntityId: string
): PlayerIdentityState => {
    const secretIndex = state.knownSecrets.findIndex(s => s.id === secretId);
    if (secretIndex === -1) return state;

    const secret = state.knownSecrets[secretIndex];
    if (secret.knownBy.includes(targetEntityId)) return state;

    const updatedSecret = {
        ...secret,
        knownBy: [...secret.knownBy, targetEntityId]
    };

    const newSecrets = [...state.knownSecrets];
    newSecrets[secretIndex] = updatedSecret;

    return {
        ...state,
        knownSecrets: newSecrets
    };
};
