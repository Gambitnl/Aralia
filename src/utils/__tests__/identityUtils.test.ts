
import { describe, it, expect } from 'vitest';
import {
    createAlias,
    createDisguise,
    calculateDisguiseDC,
    attemptDisguiseCheck,
    getInitialIdentityState,
    recordDiscovery
} from '../identityUtils';
import { DisguiseQuality, DisguiseVulnerability } from '../../types/identity';
import { NPC } from '../../types';

describe('Identity System Utils', () => {

    describe('createAlias', () => {
        it('should create a new alias with default values', () => {
            const alias = createAlias('Count Vane', 'A mysterious noble from the north.');
            expect(alias.id).toBeDefined();
            expect(alias.name).toBe('Count Vane');
            expect(alias.isExposed).toBe(false);
            expect(alias.reputation).toEqual({});
        });
    });

    describe('createDisguise', () => {
        it('should create a disguise linked to an alias', () => {
            const aliasId = 'test-alias-id';
            const disguise = createDisguise(aliasId, 'good', 'A red velvet cloak and golden mask.');

            expect(disguise.aliasId).toBe(aliasId);
            expect(disguise.quality).toBe('good');
            expect(disguise.visualDescription).toContain('red velvet');
        });

        it('should include vulnerabilities if provided', () => {
            const vuln: DisguiseVulnerability = {
                id: 'voice',
                description: 'Accent slips when angry',
                trigger: 'speech',
                detectionBonus: 5
            };
            const disguise = createDisguise('id', 'poor', 'desc', [vuln]);
            expect(disguise.vulnerabilities).toHaveLength(1);
            expect(disguise.vulnerabilities[0].trigger).toBe('speech');
        });
    });

    describe('calculateDisguiseDC', () => {
        it('should return correct base DC for qualities', () => {
            // Mock object structure for disguise since we only need quality
            const poor = { quality: 'poor' } as any;
            const masterwork = { quality: 'masterwork' } as any;

            expect(calculateDisguiseDC(poor)).toBe(10);
            expect(calculateDisguiseDC(masterwork)).toBe(20);
        });

        it('should add situational modifiers', () => {
            const good = { quality: 'good' } as any; // Base 16
            expect(calculateDisguiseDC(good, -5)).toBe(11); // Bright light
            expect(calculateDisguiseDC(good, 5)).toBe(21); // Shadows
        });
    });

    describe('attemptDisguiseCheck', () => {
        const mockNPC: NPC = {
            id: 'guard-1',
            name: 'City Guard',
            role: 'guard',
            baseDescription: '',
            initialPersonalityPrompt: ''
        };

        const mockDisguise = createDisguise('alias-1', 'average', 'Simple cloak'); // DC 13

        it('should handle success and failure logic', () => {
            // This test is probabilistic due to d20, so we might want to mock Math.random
            // For now, let's just check the structure of the return
            const result = attemptDisguiseCheck(mockNPC, mockDisguise);
            expect(result.dc).toBe(13);
            expect(typeof result.success).toBe('boolean');
            if (!result.success) {
                expect(result.detectedBy).toContain(mockNPC.id);
            }
        });

        it('should apply vulnerability bonuses to NPC', () => {
            // Vulnerability gives +100 to NPC roll, ensuring failure for test
            const vuln: DisguiseVulnerability = {
                id: 'obvious',
                description: 'Very obvious',
                trigger: 'speech',
                detectionBonus: 100
            };
            const badDisguise = createDisguise('alias-1', 'poor', 'Bad', [vuln]); // DC 10

            const result = attemptDisguiseCheck(mockNPC, badDisguise, 'speech');
            // NPC Roll (1..20) + Guard Bonus (2) + Vuln (100) = Min 103
            // DC = 10
            // Success = Roll < DC -> 103 < 10 -> False

            expect(result.success).toBe(false);
            expect(result.consequences).toContain(`Detected by ${mockNPC.name}`);
        });
    });

    describe('state management', () => {
        it('should initialize state correctly', () => {
            const state = getInitialIdentityState();
            expect(state.currentIdentityId).toBe('true_self');
        });

        it('should record discovery correctly', () => {
            let state = getInitialIdentityState();
            state = recordDiscovery(state, 'npc-1', 'true_self');

            expect(state.knownTo['npc-1']).toContain('true_self');

            // Deduplication
            state = recordDiscovery(state, 'npc-1', 'true_self');
            expect(state.knownTo['npc-1']).toHaveLength(1);
        });
    });

});
