import { describe, it, expect, expectTypeOf } from 'vitest';
import { Spell } from '@/types/spells';
import { Ability } from '@/types/combat';
import { createAbilityFromSpell } from '@/utils/character/spellAbilityFactory';
import { PlayerCharacter } from '@/types';

describe('contract: spells and abilities', () => {
  it('Spell definition includes targeting and effects', () => {
    const spell: Spell = {
      id: 'contract_spell',
      name: 'Contract Bolt',
      level: 1,
      school: 'Evocation' as any,
      castingTime: { value: 1, unit: 'action' },
      range: { type: 'ranged', distance: 30 },
      components: { verbal: true, somatic: true, material: false },
      duration: { type: 'instantaneous', concentration: false, value: 0 },
      description: 'A minimal spell for contract checks.',
      classes: ['Wizard'],
      // TODO(2026-01-03 Codex-CLI): Align contract targeting shape with production spell targeting union; using numeric range for compatibility.
      targeting: { type: 'single', range: 0, validTargets: ['creatures'] },
      effects: [
        {
          type: 'DAMAGE',
          damage: { dice: '1d6', type: 'fire' },
          trigger: { type: 'immediate' },
          condition: { type: 'always' },
        },
      ],
    };

    expectTypeOf(spell.targeting).toMatchTypeOf<Spell['targeting']>();
    expect(Array.isArray(spell.effects)).toBe(true);
  });

  it('Ability factory output stays compatible with combat Ability', () => {
    type AbilityReturn = ReturnType<typeof createAbilityFromSpell>;
    expectTypeOf<AbilityReturn>().toMatchTypeOf<Ability>();

    // Runtime sanity using the minimal spell above and a stub caster
    const caster: PlayerCharacter = {
      id: 'pc',
      name: 'Caster',
      race: { id: 'human', name: 'Human', description: '', traits: [] },
      class: {
        id: 'wizard',
        name: 'Wizard',
        description: '',
        hitDie: 6,
        primaryAbility: ['Intelligence'],
        savingThrowProficiencies: ['Intelligence', 'Wisdom'],
        skillProficienciesAvailable: [],
        numberOfSkillProficiencies: 0,
        armorProficiencies: [],
        weaponProficiencies: [],
        features: [],
      },
      abilityScores: { Strength: 8, Dexterity: 10, Constitution: 10, Intelligence: 14, Wisdom: 10, Charisma: 10 },
      finalAbilityScores: { Strength: 8, Dexterity: 10, Constitution: 10, Intelligence: 14, Wisdom: 10, Charisma: 10 },
      skills: [],
      hp: 5,
      maxHp: 5,
      armorClass: 10,
      speed: 30,
      darkvisionRange: 0,
      transportMode: 'foot',
      equippedItems: {},
      statusEffects: [],
    };

    const ability = createAbilityFromSpell(
      {
        id: 'contract_spell',
        name: 'Contract Bolt',
        level: 1,
        school: 'Evocation' as any,
        castingTime: { value: 1, unit: 'action' },
        range: { type: 'ranged', distance: 30 },
        components: { verbal: true, somatic: true, material: false },
        duration: { type: 'instantaneous', concentration: false, value: 0 },
        description: 'A minimal spell for contract checks.',
        classes: ['Wizard'],
        // TODO(2026-01-03 Codex-CLI): Align contract targeting shape with production spell targeting union; using numeric range for compatibility.
        targeting: { type: 'single', range: 0, validTargets: ['creatures'] },
        effects: [
          {
            type: 'DAMAGE',
            damage: { dice: '1d6', type: 'fire' },
            trigger: { type: 'immediate' },
            condition: { type: 'always' },
          },
        ],
      },
      caster,
    );

    expect(ability.name).toBe('Contract Bolt');
    expectTypeOf(ability).toMatchTypeOf<Ability>();
  });
});
