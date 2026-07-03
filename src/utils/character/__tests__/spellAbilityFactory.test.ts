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

        it('preserves mode-choice menus for spell preview and selection parity', () => {
            const modeChoiceSpell = {
                ...baseSpell,
                id: 'blindness-deafness',
                name: 'Blindness/Deafness',
                description: 'Choose Blindness or Deafness.',
                effects: [
                    {
                        type: 'STATUS_CONDITION',
                        statusCondition: { name: 'Blinded', duration: { type: 'minutes', value: 1 } },
                        trigger: { type: 'immediate' },
                        condition: { type: 'save', saveType: 'Constitution' }
                    },
                    {
                        type: 'STATUS_CONDITION',
                        statusCondition: { name: 'Deafened', duration: { type: 'minutes', value: 1 } },
                        trigger: { type: 'immediate' },
                        condition: { type: 'save', saveType: 'Constitution' }
                    }
                ],
                modeChoice: {
                    prompt: 'Choose one condition.',
                    options: [
                        { label: 'Blindness', effectIndices: [0] },
                        { label: 'Deafness', effectIndices: [1] }
                    ]
                }
            } as unknown as Spell;

            const ability = createAbilityFromSpell(modeChoiceSpell, baseCaster);

            // Mode-choice spells are narrowed later by SpellCommandFactory using
            // player input. The preview/selection ability must keep that menu
            // visible so the UI can ask for the same choice the command path
            // expects instead of showing one flattened generic status ability.
            expect((ability as any).modeChoice).toEqual(modeChoiceSpell.modeChoice);
        });

        it('uses structured targeting before description or tag fallbacks', () => {
            const structuredAreaSpell = {
                ...baseSpell,
                id: 'structured-point-area',
                name: 'Structured Point Area',
                description: 'Choose a point and fill a sphere with force.',
                range: { type: 'ranged', distance: 120 },
                tags: ['healing'],
                targeting: {
                    type: 'point',
                    range: 120,
                    validTargets: ['point'],
                    areaOfEffect: { shape: 'Sphere', size: 20 }
                }
            } as unknown as Spell;

            const structuredEnemySpell = {
                ...baseSpell,
                id: 'structured-enemy-ray',
                name: 'Structured Enemy Ray',
                description: 'A creature of your choice receives a helpful glow.',
                tags: ['buff'],
                targeting: {
                    type: 'single',
                    range: 60,
                    validTargets: ['enemies']
                }
            } as unknown as Spell;

            const structuredAreaAbility = createAbilityFromSpell(structuredAreaSpell, baseCaster);
            const structuredEnemyAbility = createAbilityFromSpell(structuredEnemySpell, baseCaster);

            // These checks protect the JSON-to-UI bridge. The first spell would
            // previously fall through to a single-target guess, while the second
            // could be misread as an ally buff from tags/prose even though the
            // structured targeting says it chooses enemies.
            expect(structuredAreaAbility.targeting).toBe('area');
            expect(structuredEnemyAbility.targeting).toBe('single_enemy');
        });

        it('translates UTILITY effects (light and savePenalty) correctly', () => {
            const utilitySpell = {
                ...baseSpell,
                effects: [
                    {
                        type: 'UTILITY',
                        utilityType: 'light',
                        light: { brightRadius: 20, dimRadius: 20 }
                    },
                    {
                        type: 'UTILITY',
                        utilityType: 'other',
                        savePenalty: { dice: '1d4', applies: 'next_save' }
                    }
                ]
            } as unknown as Spell;

            const ability = createAbilityFromSpell(utilitySpell, baseCaster);
            expect(ability.effects.length).toBe(2);
            expect(ability.effects[0].type).toBe('status');
            expect(ability.effects[0].statusEffect?.light).toEqual({
                brightRadius: 20,
                dimRadius: 20,
                attachedTo: 'target',
                color: undefined,
                opaqueCoverBlocks: false
            });
            expect(ability.effects[1].statusEffect?.savePenalty).toEqual({
                dice: '1d4',
                flat: undefined,
                applies: 'next_save'
            });
        });

        it('preserves granted post-cast actions on generated combat abilities', () => {
            const grantedActionSpell = {
                ...baseSpell,
                id: 'minor-illusion-style-action',
                name: 'Minor Illusion Style Action',
                description: 'Creates an illusion that can be manipulated after casting.',
                effects: [
                    {
                        type: 'UTILITY',
                        utilityType: 'illusion',
                        trigger: { type: 'immediate' },
                        condition: { type: 'always' },
                        grantedActions: [
                            {
                                type: 'action',
                                action: 'Move Illusion',
                                frequency: 'each_turn',
                                actor: 'caster',
                                actionKind: 'magic_action',
                                notes: 'The caster can use a later action to manipulate the illusion.'
                            }
                        ]
                    }
                ]
            } as unknown as Spell;

            const ability = createAbilityFromSpell(grantedActionSpell, baseCaster);

            // Granted actions are not immediate damage/status effects. They are
            // future player options created by the spell, so the generated
            // combat ability must keep them in a direct UI-readable field
            // instead of burying them inside raw spell JSON.
            expect(ability.grantedActions).toEqual([
                {
                    type: 'action',
                    action: 'Move Illusion',
                    frequency: 'each_turn',
                    actor: 'caster',
                    actionKind: 'magic_action',
                    notes: 'The caster can use a later action to manipulate the illusion.'
                }
            ]);
        });

        it('scales Spare the Dying range from caster level instead of spell-slot level', () => {
            const spareTheDying = {
                ...baseSpell,
                id: 'spare-the-dying',
                name: 'Spare the Dying',
                level: 0,
                description: 'Choose a creature within range that has 0 Hit Points and is not dead.',
                range: { type: 'ranged', distance: 15 },
                targeting: { type: 'single', range: 15, validTargets: ['creatures'] }
            } as unknown as Spell;

            const levelOneAbility = createAbilityFromSpell(spareTheDying, {
                ...baseCaster,
                level: 1
            });
            const levelFiveAbility = createAbilityFromSpell(spareTheDying, {
                ...baseCaster,
                level: 5
            });
            const levelElevenAbility = createAbilityFromSpell(spareTheDying, {
                ...baseCaster,
                level: 11
            });
            const levelSeventeenAbility = createAbilityFromSpell(spareTheDying, {
                ...baseCaster,
                level: 17
            });

            // Combat abilities store range in 5-foot tiles. These expectations
            // prove the cantrip tier text becomes the actual targeting radius
            // used by the battle-map ability picker.
            expect(levelOneAbility.range).toBe(3);
            expect(levelFiveAbility.range).toBe(6);
            expect(levelElevenAbility.range).toBe(12);
            expect(levelSeventeenAbility.range).toBe(24);
        });
    });
});
