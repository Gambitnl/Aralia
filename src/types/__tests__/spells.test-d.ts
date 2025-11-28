import { expectType, expectError } from 'tsd';
import type { Spell, SpellEffect, DamageEffect, DamageData, HealingEffect, StatusConditionEffect, ConditionName } from '../spells';

// A mock function to get a generic spell effect
declare function getSpellEffect(): SpellEffect;

// A mock function to get a specific damage effect
declare function getDamageEffect(): DamageEffect;

describe('Spell System Type-Level Tests', () => {
  it('should correctly narrow discriminated unions', () => {
    const effect = getSpellEffect();

    if (effect.type === 'DAMAGE') {
      expectType<DamageEffect>(effect);
      expectType<DamageData>(effect.damage);
    }

    if (effect.type === 'HEALING') {
      expectType<HealingEffect>(effect);
      expectError(effect.damage); // Should not have damage property
    }

    if (effect.type === 'STATUS_CONDITION') {
        expectType<StatusConditionEffect>(effect);
        expectType<ConditionName>(effect.statusCondition.name);
    }
  });

  it('should enforce required fields on the Spell interface', () => {
    const validSpell: Spell = {
        id: 'fireball',
        name: 'Fireball',
        level: 3,
        school: 'Evocation',
        classes: ['Sorcerer', 'Wizard'],
        castingTime: { value: 1, unit: 'action' },
        range: { type: 'ranged', distance: 150 },
        components: { verbal: true, somatic: true, material: true },
        duration: { type: 'instantaneous', concentration: false },
        targeting: {
          type: 'area',
          range: 150,
          areaOfEffect: { shape: 'Sphere', size: 20 },
          validTargets: ['creatures', 'objects'],
        },
        effects: [],
        description: 'A bright streak flashes from your pointing finger...',
    };
    expectType<Spell>(validSpell);

    // @ts-expect-error
    const invalidSpell: Spell = { id: 'missing_fields' };
  });

  it('should ensure damage type is a valid DamageType', () => {
    const validDamage: DamageData = { dice: '1d6', type: 'Fire' };
    expectType<DamageData>(validDamage);

    // @ts-expect-error
    const invalidDamage: DamageData = { dice: '1d6', type: 'NotARealType' };
  });
});
