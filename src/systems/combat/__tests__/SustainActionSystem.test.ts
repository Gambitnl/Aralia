/**
 * This file contains unit tests for the SustainActionSystem class.
 *
 * It validates spell registration, sustain prompt logic, action matching, turn-end resets,
 * and confirms that the singleton test isolation helper functions correctly.
 *
 * Runs on: vitest.
 * Depends on: SustainActionSystem, combatEmitters test isolation utility.
 */

// ============================================================================
// Imports
// ============================================================================

import { describe, it, expect } from 'vitest';
import { SustainActionSystem, SustainedSpell } from '../SustainActionSystem';
import { isolateSustainSystem } from '../../../test/combatEmitters';
import { createMockCombatState } from '@/utils/factories';

// ============================================================================
// Test Suite: SustainActionSystem and Test Isolation
// ============================================================================

describe('SustainActionSystem', () => {
    const mockState = createMockCombatState();

    const createMockSpell = (casterId: string, spellId: string, actionType: 'action' | 'bonus_action' | 'reaction' = 'action'): SustainedSpell => ({
        spellId,
        casterId,
        targetIds: ['target-1'],
        sustainCost: {
            actionType,
            optional: false
        },
        effectIds: [`effect-${spellId}`],
        sustainedThisTurn: false
    });

    it('allows registering and retrieving sustained spells', async () => {
        await isolateSustainSystem((system) => {
            const spell = createMockSpell('caster-1', 'spell-1');
            system.registerSustainedSpell(spell);

            const spells = system.getSustainedSpellsForCaster('caster-1');
            expect(spells.length).toBe(1);
            expect(spells[0].spellId).toBe('spell-1');

            const allSpells = system.getAllSustainedSpells();
            expect(allSpells.length).toBe(1);
        });
    });

    it('allows removing sustained spells', async () => {
        await isolateSustainSystem((system) => {
            const spell = createMockSpell('caster-1', 'spell-1');
            system.registerSustainedSpell(spell);
            expect(system.getSustainedSpellsForCaster('caster-1').length).toBe(1);

            system.removeSustainedSpell('caster-1', 'spell-1');
            expect(system.getSustainedSpellsForCaster('caster-1').length).toBe(0);
        });
    });

    it('generates sustain prompts when spells are not sustained yet', async () => {
        await isolateSustainSystem((system) => {
            const spell = createMockSpell('caster-1', 'spell-1');
            system.registerSustainedSpell(spell);

            const prompt = system.getSustainPrompt(mockState, 'caster-1');
            expect(prompt).not.toBeNull();
            expect(prompt?.casterId).toBe('caster-1');
            expect(prompt?.sustainedSpells.length).toBe(1);
            expect(prompt?.sustainedSpells[0].spellId).toBe('spell-1');
            expect(prompt?.availableActions).toContain('action');
        });
    });

    it('returns null prompt if all spells have already been sustained this turn', async () => {
        await isolateSustainSystem((system) => {
            const spell = createMockSpell('caster-1', 'spell-1');
            system.registerSustainedSpell(spell);

            const sustainSuccess = system.sustainSpell('caster-1', 'spell-1', 'action');
            expect(sustainSuccess).toBe(true);

            const prompt = system.getSustainPrompt(mockState, 'caster-1');
            expect(prompt).toBeNull();
        });
    });

    it('validates action types before sustaining a spell', async () => {
        await isolateSustainSystem((system) => {
            const spell = createMockSpell('caster-1', 'spell-1', 'bonus_action');
            system.registerSustainedSpell(spell);

            // Try to sustain using standard 'action' instead of required 'bonus_action'
            const badSustain = system.sustainSpell('caster-1', 'spell-1', 'action');
            expect(badSustain).toBe(false);

            // Sustain using correct 'bonus_action'
            const goodSustain = system.sustainSpell('caster-1', 'spell-1', 'bonus_action');
            expect(goodSustain).toBe(true);
        });
    });

    it('identifies and removes unsustained spells at turn end', async () => {
        await isolateSustainSystem((system) => {
            const spell1 = createMockSpell('caster-1', 'spell-1'); // Will be sustained
            const spell2 = createMockSpell('caster-1', 'spell-2'); // Will NOT be sustained
            system.registerSustainedSpell(spell1);
            system.registerSustainedSpell(spell2);

            // Sustain only spell-1
            system.sustainSpell('caster-1', 'spell-1', 'action');

            // Process turn end
            const effectsToRemove = system.processTurnEnd('caster-1');
            
            // spell-2 was unsustained, so its effect should be returned for removal, and it should be removed from tracking.
            expect(effectsToRemove).toContain('effect-spell-2');
            expect(effectsToRemove).not.toContain('effect-spell-1');

            const spellsLeft = system.getSustainedSpellsForCaster('caster-1');
            expect(spellsLeft.length).toBe(1);
            expect(spellsLeft[0].spellId).toBe('spell-1');
        });
    });

    it('resets sustained status at round start', async () => {
        await isolateSustainSystem((system) => {
            const spell = createMockSpell('caster-1', 'spell-1');
            system.registerSustainedSpell(spell);

            system.sustainSpell('caster-1', 'spell-1', 'action');
            expect(system.getSustainPrompt(mockState, 'caster-1')).toBeNull();

            // Reset for new round
            system.resetForNewRound();

            // Caster should be prompted to sustain again
            expect(system.getSustainPrompt(mockState, 'caster-1')).not.toBeNull();
        });
    });

    it('guarantees complete test isolation using isolateSustainSystem helper', async () => {
        const defaultInstance = SustainActionSystem.getInstance();
        const defaultSpell = createMockSpell('caster-default', 'spell-default');
        defaultInstance.registerSustainedSpell(defaultSpell);

        isolateSustainSystem((isolatedSystem) => {
            const isolatedSpell = createMockSpell('caster-isolated', 'spell-isolated');
            isolatedSystem.registerSustainedSpell(isolatedSpell);

            expect(isolatedSystem.getSustainedSpellsForCaster('caster-isolated').length).toBe(1);
            expect(isolatedSystem.getSustainedSpellsForCaster('caster-default').length).toBe(0);
        });

        expect(defaultInstance.getSustainedSpellsForCaster('caster-isolated').length).toBe(0);
        expect(defaultInstance.getSustainedSpellsForCaster('caster-default').length).toBe(1);

        defaultInstance.removeSustainedSpell('caster-default', 'spell-default');
    });
});
