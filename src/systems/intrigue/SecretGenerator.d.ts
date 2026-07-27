/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intrigue/SecretGenerator.ts
 * Generates procedural secrets for factions and NPCs.
 */
import { Secret } from '../../types/identity';
import { Faction } from '../../types/factions';
export declare class SecretGenerator {
    private rng;
    constructor(seed: number);
    /**
     * Generates a secret about a specific faction.
     * @param subjectFaction The faction the secret is about.
     * @param otherFactions List of other factions to be potential targets/beneficiaries.
     */
    generateFactionSecret(subjectFaction: Faction, otherFactions: Faction[]): Secret;
    /**
     * Generates a secret about a specific individual (e.g. noble member).
     */
    generateMemberSecret(subjectId: string, subjectName: string, potentialTargets?: string[]): Secret;
    /**
     * Generates a random secret for a generic noble house context.
     */
    generateRandomSecret(factions: Faction[]): Secret | null;
}
