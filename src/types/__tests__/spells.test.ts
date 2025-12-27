import { describe, it, expect } from 'vitest';
import {
  isSpell,
  isDamageEffect,
  isHealingEffect,
  isStatusConditionEffect,
  SpellSchool,
} from '../spells';
import type { Spell, DamageEffect, HealingEffect, StatusConditionEffect, SpellEffect } from '../spells';

// A mock valid spell object for testing
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

// Mock spell effects for testing type guards
const damageEffect: DamageEffect = {
  type: 'DAMAGE',
  damage: { dice: '8d6', type: 'Fire' },
  trigger: { type: 'immediate' },
  condition: { type: 'save', saveType: 'Dexterity', saveEffect: 'half' },
};

const healingEffect: HealingEffect = {
    type: 'HEALING',
    healing: { dice: '2d8' },
    trigger: { type: 'immediate' },
    condition: { type: 'always' },
};

const statusEffect: StatusConditionEffect = {
    type: 'STATUS_CONDITION',
    statusCondition: { name: 'Blinded', duration: {type: 'rounds', value: 1} },
    trigger: { type: 'immediate' },
    condition: { type: 'save', saveType: 'Constitution' },
};

describe('Spell System Type Guards', () => {
  describe('isSpell', () => {
    it('should return true for a valid spell object', () => {
      expect(isSpell(validSpell)).toBe(true);
    });

    it('should return false for an object missing required fields', () => {
      const invalidSpell = { id: 'test', name: 'Test' };
      expect(isSpell(invalidSpell)).toBe(false);
    });

    it('should return false for non-object types', () => {
      expect(isSpell(null)).toBe(false);
      expect(isSpell(undefined)).toBe(false);
      expect(isSpell('fireball')).toBe(false);
      expect(isSpell(123)).toBe(false);
    });
  });

  describe('Effect Type Guards', () => {
    const effects: SpellEffect[] = [damageEffect, healingEffect, statusEffect];

    it('isDamageEffect should correctly identify DAMAGE effects', () => {
      expect(isDamageEffect(effects[0])).toBe(true);
      expect(isDamageEffect(effects[1])).toBe(false);
    });

    it('isHealingEffect should correctly identify HEALING effects', () => {
        expect(isHealingEffect(effects[1])).toBe(true);
        expect(isHealingEffect(effects[0])).toBe(false);
    });

    it('isStatusConditionEffect should correctly identify STATUS_CONDITION effects', () => {
        expect(isStatusConditionEffect(effects[2])).toBe(true);
        expect(isStatusConditionEffect(effects[0])).toBe(false);
    });
  });
});
