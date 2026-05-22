import { describe, it, expect, vi } from 'vitest';
import { createPlayerCombatCharacter } from '../combatUtils';
import { createMockGameState, createMockPlayerCharacter } from '../../factories';

// Mock getAbilityModifierValue locally to avoid dependencies on external utils
vi.mock('../../character/statUtils', () => ({
  getAbilityModifierValue: (score: number) => Math.floor((score - 10) / 2)
}));

// Mock buildHitPointDicePools
vi.mock('../../character/characterUtils', () => ({
  buildHitPointDicePools: () => []
}));

// We only need a partial implementation of weaponUtils for our mock testing
vi.mock('../../character/weaponUtils', () => ({
  isWeaponProficient: () => true
}));

// We also need to mock createAbilityFromSpell
vi.mock('../../character/spellAbilityFactory', () => ({
  createAbilityFromSpell: () => ({ id: 'mock_spell_ability', name: 'Mock Spell' })
}));


describe('combatUtils: createPlayerCombatCharacter premade loadout', () => {
  it('should map armorClass to AC and baseAC', () => {
    const player = createMockPlayerCharacter({
      armorClass: 16
    });

    const combatChar = createPlayerCombatCharacter(player);

    expect(combatChar.armorClass).toBe(16);
    expect(combatChar.baseAC).toBe(16);
  });

  it('should parse ranged weapon range property correctly', () => {
    const player = createMockPlayerCharacter({
      equippedItems: {
        MainHand: {
          id: 'longbow',
          name: 'Longbow',
          type: 'weapon',
          category: 'Martial Ranged Weapon',
          damageDice: '1d8',
          damageType: 'piercing',
          properties: ['ammunition', 'heavy', 'range:150/600', 'two-handed']
        }
      } as any
    });

    const combatChar = createPlayerCombatCharacter(player);

    // Range 150 ft means 150 / 5 = 30 tiles range
    const attackAbility = combatChar.abilities.find(a => a.id === 'attack_main');
    expect(attackAbility).toBeDefined();
    expect(attackAbility?.range).toBe(30);
  });
});
