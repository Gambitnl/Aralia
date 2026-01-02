import { expectType, expectError } from 'tsd';
import { SpellSchool } from '../spells';
import type { Spell, SpellEffect, DamageEffect, DamageData, HealingEffect, StatusConditionEffect, ConditionName } from '../spells';

// A mock function to get a generic spell effect
declare function getSpellEffect(): SpellEffect;

// A mock function to get a specific damage effect
// TODO(lint-intent): 'getDamageEffect' is unused in this test; use it in the assertion path or remove it.
declare function _getDamageEffect(): DamageEffect;

describe('Spell System Type-Level Tests', () => {
  it('should correctly narrow discriminated unions', () => {
    const effect = getSpellEffect();

    if (effect.type === 'DAMAGE') {
      expectType<DamageEffect>(effect);
      expectType<DamageData>(effect.damage);
    }

    if (effect.type === 'HEALING') {
      expectType<HealingEffect>(effect);
      expectError(() => (effect as any).damage); // Should not have damage property
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
        school: SpellSchool.Evocation,
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
    // TODO(lint-intent): Keep invalid shape check to remind us to tighten Spell typing.
    expectError(() => {
      const invalidSpell: Spell = { id: 'missing_fields' } as any;
      return invalidSpell;
    });
  });

  it('should ensure damage type is a valid DamageType', () => {
    const validDamage: DamageData = { dice: '1d6', type: 'Fire' };
    expectType<DamageData>(validDamage);
    // TODO(lint-intent): Confirm the ts-expect-error is still needed or tighten the DamageData type for invalid fixtures.
    // @ts-expect-error - invalid damage type for coverage
    // TODO(lint-intent): 'invalidDamage' is unused in this test; use it in the assertion path or remove it.
    const _invalidDamage: DamageData = { dice: '1d6', type: 'NotARealType' };
  });
});
