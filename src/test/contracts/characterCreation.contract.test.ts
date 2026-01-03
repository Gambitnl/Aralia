import { describe, it, expect, expectTypeOf } from 'vitest';
import { Class, FightingStyle, GiantAncestryBenefit, FiendishLegacy, FiendishLegacyType } from '@/types/character';

describe('contract: character creation shapes', () => {
  it('Class requires core progress fields', () => {
    const cls: Class = {
      id: 'fighter',
      name: 'Fighter',
      description: '',
      hitDie: 10,
      primaryAbility: ['Strength'],
      savingThrowProficiencies: ['Strength', 'Constitution'],
      skillProficienciesAvailable: [],
      numberOfSkillProficiencies: 0,
      armorProficiencies: [],
      weaponProficiencies: [],
      features: [],
    };
    expectTypeOf(cls).toMatchTypeOf<Class>();
  });

  it('FightingStyle includes levelAvailable', () => {
    const style: FightingStyle = {
      id: 'defense',
      name: 'Defense',
      description: 'Armor helps.',
      levelAvailable: 1,
    };
    expect(style.levelAvailable).toBeGreaterThan(0);
  });

  it('Ancestry/legacy helpers capture required fields', () => {
    const ancestry: GiantAncestryBenefit = {
      id: 'Cloud',
      name: 'Cloud',
      description: 'Storm lineage'
    };
    const legacy: FiendishLegacy = {
      id: 'abyssal' as FiendishLegacyType,
      name: 'Abyssal',
      description: 'Legacy',
      level1Benefit: { resistanceType: 'fire', cantripId: 'fire-bolt' },
      level3SpellId: 'darkness',
      level5SpellId: 'fear',
    };
    expectTypeOf(ancestry).toMatchTypeOf<GiantAncestryBenefit>();
    expectTypeOf(legacy).toMatchTypeOf<FiendishLegacy>();
  });
});
