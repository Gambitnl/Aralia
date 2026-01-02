import { describe, it, expect } from 'vitest';
import { createAbilityFromSpell } from '../spellAbilityFactory';
import { Spell } from '@/types/spells';
import { PlayerCharacter } from '@/types/index';
import { createMockPlayerCharacter } from '../../core/factories';

describe('spellAbilityFactory', () => {
    describe('createAbilityFromSpell', () => {
        // Safe base mocks
        const baseSpell: Spell = {
            id: 'test-spell',
            name: 'Test Spell',
            level: 1,
            school: 'Evocation',
            classes: ['Wizard'],
            description: 'Deals damage.',
            source: 'PHB',
            legacy: false,
            ritual: false,
            rarity: 'common',
            attackType: 'ranged',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'ranged', distance: 60 },
            components: { verbal: true, somatic: true, material: false },
            duration: { type: 'instantaneous' },
            targeting: { type: 'single' },
            effects: [],
            arbitrationType: 'mechanical'
        } as unknown as Spell;

        const baseCaster = createMockPlayerCharacter({
            spellcastingAbility: 'Intelligence',
            finalAbilityScores: {
                Strength: 10,
                Dexterity: 10,
                Constitution: 10,
                Intelligence: 16,
                Wisdom: 10,
                Charisma: 10
            }
        });

        it('handles undefined description without crashing', () => {
            const malformedSpell = { ...baseSpell, description: undefined } as unknown as Spell;
            expect(() => createAbilityFromSpell(malformedSpell, baseCaster)).not.toThrow();
        });

        it('handles effects array containing nulls without crashing', () => {
             const malformedSpell = {
                ...baseSpell,
                effects: [null, { type: 'DAMAGE', damage: { dice: '1d6', type: 'Fire' } }]
            } as unknown as Spell;

            expect(() => createAbilityFromSpell(malformedSpell, baseCaster)).not.toThrow();
        });

        it('handles undefined caster.finalAbilityScores without crashing', () => {
            const brokenCaster = {
                ...baseCaster,
                finalAbilityScores: undefined
            } as unknown as PlayerCharacter;

            expect(() => createAbilityFromSpell(baseSpell, brokenCaster)).not.toThrow();
        });

        it('handles completely null caster gracefully', () => {
            // This is a catastrophic failure case
             expect(() => createAbilityFromSpell(baseSpell, null as unknown as PlayerCharacter)).not.toThrow();
        });

        it('handles null spell gracefully', () => {
             expect(() => createAbilityFromSpell(null as unknown as Spell, baseCaster)).not.toThrow();
        });
    });
});
