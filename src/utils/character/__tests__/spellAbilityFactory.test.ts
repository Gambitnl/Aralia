import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
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

        it('writes DEFENSIVE AC effects as Armor Class, not as a Dexterity placeholder', () => {
            const acSpell = {
                ...baseSpell,
                id: 'ac-buff-spell',
                name: 'AC Buff Spell',
                effects: [
                    {
                        type: 'DEFENSIVE',
                        defenseType: 'ac_bonus',
                        acBonus: 2,
                        // Every DEFENSIVE row carries these zero-filled siblings even
                        // when the spell does not use them. They must not leak into
                        // the status as a base AC of 0 or an AC floor of 0.
                        value: 0,
                        acMinimum: 0,
                        baseACFormula: '',
                        duration: { type: 'minutes', value: 10 }
                    }
                ]
            } as unknown as Spell;

            const status = createAbilityFromSpell(acSpell, baseCaster).effects[0]?.statusEffect;

            expect(status?.modifiers).toEqual({ acBonus: 2 });
            expect(status?.effect).toBeUndefined();
            // 10 minutes is 100 rounds at 6 seconds per round.
            expect(status?.duration).toBe(100);
        });

        it('maps DEFENSIVE resistance onto the status resistance list', () => {
            const resistanceSpell = {
                ...baseSpell,
                id: 'resist-spell',
                name: 'Resist Spell',
                effects: [
                    {
                        type: 'DEFENSIVE',
                        defenseType: 'resistance',
                        damageType: ['fire'],
                        duration: { type: 'rounds', value: 3 }
                    }
                ]
            } as unknown as Spell;

            const status = createAbilityFromSpell(resistanceSpell, baseCaster).effects[0]?.statusEffect;

            expect(status?.modifiers?.resistance).toEqual(['fire']);
            expect(status?.duration).toBe(3);
        });

        it('reads an outgoing attack penalty as a debuff and fills the holder modifier lists', () => {
            const outgoingPenaltySpell = {
                ...baseSpell,
                id: 'outgoing-penalty',
                name: 'Outgoing Penalty',
                effects: [
                    {
                        type: 'ATTACK_ROLL_MODIFIER',
                        attackRollModifier: {
                            modifier: 'disadvantage',
                            direction: 'outgoing',
                            attackKind: 'weapon',
                            consumption: 'next_attack',
                            duration: { type: 'rounds', value: 2 }
                        },
                        statusCondition: { name: 'Hobbled Aim' }
                    }
                ]
            } as unknown as Spell;

            const status = createAbilityFromSpell(outgoingPenaltySpell, baseCaster).effects[0]?.statusEffect;

            expect(status?.type).toBe('debuff');
            expect(status?.name).toBe('Hobbled Aim');
            expect(status?.attackRollRider?.attackKind).toBe('weapon');
            expect(status?.attackRollRider?.consumption).toBe('next_attack');
            expect(status?.modifiers?.disadvantage).toEqual(['attack']);
        });

        it('emits both a terrain status and a damage effect for damaging terrain', () => {
            const spikeTerrainSpell = {
                ...baseSpell,
                id: 'spike-terrain',
                name: 'Spike Terrain',
                effects: [
                    {
                        type: 'TERRAIN',
                        terrainType: 'damaging',
                        areaOfEffect: { shape: 'Sphere', size: 20 },
                        duration: { type: 'minutes', value: 1 },
                        damage: { dice: '2d4', type: 'Piercing' }
                    }
                ]
            } as unknown as Spell;

            const effects = createAbilityFromSpell(spikeTerrainSpell, baseCaster).effects;

            // Damaging terrain has to read as damage too. combatAI scores an
            // ability from this list, so a zone that is only a status scores as
            // dealing nothing.
            expect(effects.map(effect => effect.type)).toEqual(['status', 'damage']);
            expect(effects[0].statusEffect?.type).toBe('debuff');
            expect(effects[0].statusEffect?.terrain?.damage).toEqual({ dice: '2d4', type: 'Piercing' });
            expect(effects[1].dice).toBe('2d4');
            expect(effects[1].damageType).toBe('piercing');
        });

        it('turns a MOVEMENT speed change into a timed status instead of immediate movement', () => {
            const slowSpell = {
                ...baseSpell,
                id: 'slow-step',
                name: 'Slow Step',
                effects: [
                    {
                        type: 'MOVEMENT',
                        movementType: 'speed_change',
                        speedChange: { stat: 'speed', value: -10, unit: 'feet' },
                        duration: { type: 'rounds', value: 4 }
                    }
                ]
            } as unknown as Spell;

            const status = createAbilityFromSpell(slowSpell, baseCaster).effects[0]?.statusEffect;

            expect(status?.type).toBe('debuff');
            expect(status?.modifiers?.movementSpeed).toBe(-10);
            expect(status?.duration).toBe(4);
        });

        it('translates a MOVEMENT push into a movement effect carrying its distance', () => {
            const pushSpell = {
                ...baseSpell,
                id: 'push-spell',
                name: 'Push Spell',
                effects: [
                    {
                        type: 'MOVEMENT',
                        movementType: 'push',
                        distance: 15,
                        duration: { type: 'instantaneous' }
                    }
                ]
            } as unknown as Spell;

            const effects = createAbilityFromSpell(pushSpell, baseCaster).effects;

            expect(effects).toEqual([{ type: 'movement', value: 15 }]);
        });
    });
});

/**
 * Corpus coverage (agora-f821.46 / agora-f821.47).
 *
 * The factory reads structured spell data only, so an ability with no effects
 * means the JSON row for that spell is not translated anywhere. These tests walk
 * the real files under public/data/spells rather than fixtures, which is the
 * only way a newly added spell with an untranslated effect type gets caught.
 */
describe('spellAbilityFactory spell corpus', () => {
    const SPELL_ROOT = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../../../public/data/spells'
    );

    const collectSpellFiles = (dir: string): string[] => {
        return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) return collectSpellFiles(full);
            return entry.name.endsWith('.json') ? [full] : [];
        });
    };

    const loadSpell = (file: string): Spell =>
        JSON.parse(fs.readFileSync(file, 'utf-8')) as Spell;

    const corpusCaster = createMockPlayerCharacter({
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

    const spellFiles = collectSpellFiles(SPELL_ROOT);

    it('reads the whole spell corpus off disk', () => {
        expect(spellFiles.length).toBeGreaterThan(400);
    });

    it('builds at least one ability effect for every spell that is not an interrupt', () => {
        const emptyEffectSpells = spellFiles
            .filter(file => {
                const spell = loadSpell(file);
                // Interrupt spells declare their whole mechanic in
                // `interruptionState` and are run by the reaction gate, so an
                // empty ability effect list is their real contract.
                if (spell.interruptionState) return false;
                return createAbilityFromSpell(spell, corpusCaster).effects.length === 0;
            })
            .map(file => path.basename(file));

        expect(emptyEffectSpells).toEqual([]);
    });

    it('keeps Counterspell on the declared empty-effects contract', () => {
        const counterspell = loadSpell(path.join(SPELL_ROOT, 'level-3', 'counterspell.json'));

        expect(counterspell.effects).toEqual([]);
        expect(counterspell.interruptionState?.event).toBe('visible_creature_casts_spell');
        expect(createAbilityFromSpell(counterspell, corpusCaster).effects).toEqual([]);
    });

    it('is the only spell in the corpus allowed an empty effects array', () => {
        const declaredEmpty = spellFiles
            .filter(file => (loadSpell(file).effects ?? []).length === 0)
            .map(file => path.basename(file));

        expect(declaredEmpty).toEqual(['counterspell.json']);
    });

    it('translates every SUMMONING row into a summon_creature effect', () => {
        const summoningSpells = spellFiles
            .map(loadSpell)
            .filter(spell => (spell.effects ?? []).some(effect => effect?.type === 'SUMMONING'));

        expect(summoningSpells.length).toBeGreaterThan(0);

        for (const spell of summoningSpells) {
            const ability = createAbilityFromSpell(spell, corpusCaster);
            expect(
                ability.effects.some(effect => effect.type === 'summon_creature'),
                `${spell.id} lost its summon`
            ).toBe(true);
        }
    });

    it('carries the summon entity kind and count through to the ability', () => {
        const findFamiliar = loadSpell(path.join(SPELL_ROOT, 'level-1', 'find-familiar.json'));
        const summonEffect = createAbilityFromSpell(findFamiliar, corpusCaster).effects
            .find(effect => effect.type === 'summon_creature');

        expect(summonEffect?.summonEntityType).toBe('familiar');
        expect(summonEffect?.summonPersistent).toBe(true);

        const disk = loadSpell(path.join(SPELL_ROOT, 'level-1', 'tensers-floating-disk.json'));
        const diskEffect = createAbilityFromSpell(disk, corpusCaster).effects
            .find(effect => effect.type === 'summon_creature');

        expect(diskEffect?.summonEntityType).toBe('object');
        expect(diskEffect?.summonCount).toBe(1);
    });

    it('gives every spell named on agora-f821.46 a non-empty effect list', () => {
        const namedOnTask = [
            'blade-ward', 'frostbite', 'mold-earth', 'bane', 'bless', 'find-familiar',
            'fog-cloud', 'tensers-floating-disk', 'blur', 'find-steed', 'levitate',
            'misty-step', 'summon-beast', 'conjure-animals', 'phantom-steed', 'summon-fey',
            'summon-undead', 'summon-aberration', 'summon-construct', 'summon-elemental',
            'summon-celestial', 'summon-dragon', 'summon-fiend'
        ];

        const byId = new Map(spellFiles.map(file => loadSpell(file)).map(spell => [spell.id, spell]));
        const stillEmpty = namedOnTask.filter(id => {
            const spell = byId.get(id);
            if (!spell) return true;
            return createAbilityFromSpell(spell, corpusCaster).effects.length === 0;
        });

        expect(stillEmpty).toEqual([]);
    });
});
