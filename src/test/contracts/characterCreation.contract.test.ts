import { describe, it, expect, expectTypeOf } from 'vitest';
import { Class, FightingStyle, GiantAncestryBenefit, TieflingLegacyResistance } from '@/types/character';

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
    const resistance: TieflingLegacyResistance = { resistanceType: 'fire', cantripId: 'thaumaturgy' };
    const ancestry: GiantAncestryBenefit = {
      id: 'cloud',
      name: 'Cloud',
      description: 'Storm lineage',
      ancestry: 'cloud',
      benefit: 'Tempest',
    };
    expectTypeOf(resistance).toMatchTypeOf<TieflingLegacyResistance>();
    expectTypeOf(ancestry).toMatchTypeOf<GiantAncestryBenefit>();
  });
});
