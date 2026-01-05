/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intrigue/__tests__/SecretSystem.test.ts
 * Tests for the Secret Generation and Identity Management logic.
 */

import { describe, it, expect } from 'vitest';
import { SecretGenerator } from '../SecretGenerator';
import { IdentityManager } from '../IdentityManager';
import { Faction } from '../../../types/factions';
// TODO(lint-intent): 'PlayerIdentityState' is unused in this test; use it in the assertion path or remove it.
import { PlayerIdentityState as _PlayerIdentityState, Secret } from '../../../types/identity';

describe('SecretSystem', () => {
    // Mock factions
    const factionA: Faction = {
        id: 'faction_a',
        name: 'House Stark',
        description: 'Winter is Coming',
        type: 'NOBLE_HOUSE',
        colors: { primary: '#000', secondary: '#fff' },
        ranks: [],
        allies: [],
        enemies: [],
        rivals: [],
        relationships: {},
        values: ['honor'],
        hates: ['treachery'],
        power: 50,
        assets: []
    };

    const factionB: Faction = {
        id: 'faction_b',
        name: 'House Lannister',
        description: 'Hear Me Roar',
        type: 'NOBLE_HOUSE',
        colors: { primary: '#f00', secondary: '#ff0' },
        ranks: [],
        allies: [],
        enemies: [],
        rivals: [],
        relationships: {},
        values: ['wealth'],
        hates: ['poverty'],
        power: 80,
        assets: []
    };

    describe('SecretGenerator', () => {
        it('should generate a secret for a faction', () => {
            const generator = new SecretGenerator(12345);
            const secret = generator.generateFactionSecret(factionA, [factionB]);

            expect(secret).toBeDefined();
            expect(secret.subjectId).toBe(factionA.id);
            expect(secret.content).toContain('House Stark');
            // Check value range
            expect(secret.value).toBeGreaterThanOrEqual(1);
            expect(secret.value).toBeLessThanOrEqual(10);
            // Check ID format
            expect(secret.id).toMatch(/^secret_\d+$/);
        });
    });

    describe('IdentityManager', () => {
        it('should initialize player identity state', () => {
            const state = IdentityManager.createInitialState('player_1', 'Hero', 'A simple farmer.');

            expect(state.characterId).toBe('player_1');
            expect(state.trueIdentity.name).toBe('Hero');
            expect(state.activeDisguise).toBeNull();
            expect(state.currentPersonaId).toBe(state.trueIdentity.id);
        });

        it('should allow creating an alias', () => {
            let state = IdentityManager.createInitialState('player_1', 'Hero', 'Story');
            state = IdentityManager.createAlias(state, 'The Red Viper', 'A notorious poisoner.', 'Dorne');

            expect(state.aliases).toHaveLength(1);
            expect(state.aliases[0].name).toBe('The Red Viper');
            expect(state.aliases[0].establishedIn).toContain('Dorne');
        });

        it('should allow learning secrets', () => {
            let state = IdentityManager.createInitialState('player_1', 'Hero', 'Story');
            const secret: Secret = {
                id: 's1',
                subjectId: 'f1',
                content: 'King is a lizard.',
                verified: false,
                value: 10,
                knownBy: [],
                tags: ['political']
            };

            state = IdentityManager.learnSecret(state, secret);
            expect(state.knownSecrets).toHaveLength(1);
            expect(state.knownSecrets[0].content).toBe('King is a lizard.');

            // Test duplicate prevention
            state = IdentityManager.learnSecret(state, secret);
            expect(state.knownSecrets).toHaveLength(1);
        });

        it('should calculate leverage correctly', () => {
            const secret: Secret = {
                id: 's1',
                subjectId: 'faction_b', // About House Lannister
                content: 'Secret info.',
                verified: true,
                value: 10,
                knownBy: [],
                tags: ['political']
            };

            // Leverage against subject (Blackmail)
            const leverageSelf = IdentityManager.calculateLeverage(secret, 'faction_b');
            expect(leverageSelf).toBe(15); // 1.5x multiplier

            // Leverage against unrelated party
            const leverageOther = IdentityManager.calculateLeverage(secret, 'faction_a');
            expect(leverageOther).toBe(10); // Base value
        });
    });
});
