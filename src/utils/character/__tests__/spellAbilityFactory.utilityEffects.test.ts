/**
 * @file spellAbilityFactory.utilityEffects.test.ts
 * Covers UTILITY-effect coverage in the spell-to-ability factory (TODO #1288):
 * Light's brightRadius/dimRadius reaching the combat lighting fields, and Mind
 * Sliver's savePenalty reaching the combat save-penalty fields even though its
 * JSON also carries a zeroed light block.
 */
import { describe, it, expect } from 'vitest';
import { createAbilityFromSpell } from '../spellAbilityFactory';
import { Spell } from '@/types/spells';
import { createMockPlayerCharacter } from '../../core/factories';

import lightSpellJson from '@/data/spells/level-0/light.json';
import mindSliverSpellJson from '@/data/spells/level-0/mind-sliver.json';

const caster = createMockPlayerCharacter({
    spellcastingAbility: 'intelligence',
    finalAbilityScores: {
        Strength: 10,
        Dexterity: 10,
        Constitution: 10,
        Intelligence: 16,
        Wisdom: 10,
        Charisma: 10
    }
});

describe('spellAbilityFactory UTILITY effects', () => {
    it('turns Light into an ability that attaches a light source with the JSON radii', () => {
        const ability = createAbilityFromSpell(lightSpellJson as unknown as Spell, caster);

        const lightEffect = ability.effects.find(effect => effect.statusEffect?.light);
        expect(lightEffect).toBeDefined();
        expect(lightEffect!.statusEffect!.light).toMatchObject({
            brightRadius: 20,
            dimRadius: 20,
            attachedTo: 'target'
        });
        expect(lightEffect!.statusEffect!.sourceSpellId).toBe('light');
    });

    it('turns Mind Sliver into a save-penalty ability instead of a zero-radius light', () => {
        const ability = createAbilityFromSpell(mindSliverSpellJson as unknown as Spell, caster);

        const penaltyEffect = ability.effects.find(effect => effect.statusEffect?.savePenalty);
        expect(penaltyEffect).toBeDefined();
        expect(penaltyEffect!.statusEffect!.savePenalty).toMatchObject({
            dice: '1d4',
            applies: 'next_save'
        });
        // The JSON records the penalty as 2 rounds (to the end of the caster's next turn).
        expect(penaltyEffect!.statusEffect!.duration).toBe(2);

        // Mind Sliver's UTILITY effect carries an all-zero light block as filler;
        // it must not become a light source.
        expect(ability.effects.some(effect => effect.statusEffect?.light)).toBe(false);
    });

    it('emits both riders when one UTILITY effect carries a light and a save penalty', () => {
        const dualRiderSpell = {
            id: 'dual-rider',
            name: 'Dual Rider',
            level: 0,
            school: 'Evocation',
            classes: ['Wizard'],
            description: 'Glows and weakens.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'ranged', distance: 30 },
            components: { verbal: true, somatic: false, material: false },
            duration: { type: 'timed', value: 1, unit: 'minute', concentration: false },
            targeting: { type: 'single' },
            effects: [
                {
                    type: 'UTILITY',
                    utilityType: 'light',
                    light: { brightRadius: 10, dimRadius: 5, attachedTo: 'point' },
                    savePenalty: { dice: '1d6', applies: 'all_saves', duration: { type: 'minutes', value: 1 } }
                }
            ],
            arbitrationType: 'mechanical'
        } as unknown as Spell;

        const ability = createAbilityFromSpell(dualRiderSpell, caster);

        expect(ability.effects.filter(effect => effect.statusEffect?.light)).toHaveLength(1);
        const penalty = ability.effects.find(effect => effect.statusEffect?.savePenalty);
        expect(penalty!.statusEffect!.savePenalty!.applies).toBe('all_saves');
        // One minute is ten rounds.
        expect(penalty!.statusEffect!.duration).toBe(10);
    });

    it('still routes a rider-free UTILITY effect into the ability as a neutral status', () => {
        const terrainSpell = {
            id: 'terrain-shaper',
            name: 'Terrain Shaper',
            level: 0,
            school: 'Transmutation',
            classes: ['Druid'],
            description: 'Shapes the ground.',
            castingTime: { value: 1, unit: 'action' },
            range: { type: 'ranged', distance: 30 },
            components: { verbal: true, somatic: false, material: false },
            duration: { type: 'instantaneous' },
            targeting: { type: 'single' },
            effects: [{ type: 'UTILITY', utilityType: 'other', terrainChange: { kind: 'excavate' } }],
            arbitrationType: 'mechanical'
        } as unknown as Spell;

        const ability = createAbilityFromSpell(terrainSpell, caster);

        expect(ability.effects).toHaveLength(1);
        expect(ability.effects[0].statusEffect?.id).toBe('spell_terrain-shaper_utility');
        expect(ability.effects[0].statusEffect?.type).toBe('neutral');
    });
});
