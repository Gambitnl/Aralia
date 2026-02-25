/**
 * @file src/state/payloads/identityPayloads.ts
 * Payload types for identity-related actions.
 */
import type { Alias, Disguise, Secret } from '../../types/identity';
/**
 * Payload for creating a new alias identity.
 */
export interface CreateAliasPayload {
    alias: Alias;
}
/**
 * Payload for equipping a disguise.
 */
export interface EquipDisguisePayload {
    disguise: Disguise;
}
/**
 * Payload for learning a new secret.
 */
export interface LearnSecretPayload {
    secret: Secret;
}
