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
  createAbilityFromSpell: (spell: any) => ({ id: spell.id, name: spell.name })
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

import fs from 'fs';
import path from 'path';

describe('combatUtils: dev test fixtures', () => {
  it('should have level 2 and level 3 spells prepared on the level 5 Wizard fixture', () => {
    const fixturePath = path.resolve(process.cwd(), 'public/premade-characters/maelis_quill_lvl5.json');
    const fixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

    expect(fixtureData.level).toBe(5);

    // Check spell slots
    expect(fixtureData.spellSlots.level_1.max).toBe(4);
    expect(fixtureData.spellSlots.level_2.max).toBe(3);
    expect(fixtureData.spellSlots.level_3.max).toBe(2);

    // Check prepared spells include a level 2 and 3 spell
    expect(fixtureData.spellbook.preparedSpells).toContain('misty-step'); // level 2
    expect(fixtureData.spellbook.preparedSpells).toContain('fireball'); // level 3

    // Ensure they don't have every spell prepared
    expect(fixtureData.spellbook.preparedSpells.length).toBeLessThan(15);

    // Mock dictionary for createPlayerCombatCharacter
    const mockSpellDict: Record<string, any> = {
      'misty-step': { id: 'misty-step', name: 'Misty Step', level: 2 },
      'fireball': { id: 'fireball', name: 'Fireball', level: 3 }
    };

    const combatChar = createPlayerCombatCharacter(fixtureData, mockSpellDict);

    // Confirm that the combat character received these spell abilities
    expect(combatChar.abilities.some(a => a.id === 'misty-step')).toBe(true);
    expect(combatChar.abilities.some(a => a.id === 'fireball')).toBe(true);

    // Confirm spell slots carried over
    expect(combatChar.spellSlots?.level_2.max).toBe(3);
    expect(combatChar.spellSlots?.level_3.max).toBe(2);
  });

  it('should have level 2 and level 3 spells prepared on the level 5 Cleric fixture', () => {
    const fixturePath = path.resolve(process.cwd(), 'public/premade-characters/sera_dawnmantle_lvl5.json');
    const fixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

    expect(fixtureData.level).toBe(5);

    // Check spell slots
    expect(fixtureData.spellSlots.level_1.max).toBe(4);
    expect(fixtureData.spellSlots.level_2.max).toBe(3);
    expect(fixtureData.spellSlots.level_3.max).toBe(2);

    // Check prepared spells include a level 2 and 3 spell
    expect(fixtureData.spellbook.preparedSpells).toContain('spiritual-weapon'); // level 2
    expect(fixtureData.spellbook.preparedSpells).toContain('spirit-guardians'); // level 3

    // Ensure they don't have every spell prepared
    expect(fixtureData.spellbook.preparedSpells.length).toBeLessThan(15);

    // Mock dictionary for createPlayerCombatCharacter
    const mockSpellDict: Record<string, any> = {
      'spiritual-weapon': { id: 'spiritual-weapon', name: 'Spiritual Weapon', level: 2 },
      'spirit-guardians': { id: 'spirit-guardians', name: 'Spirit Guardians', level: 3 }
    };

    const combatChar = createPlayerCombatCharacter(fixtureData, mockSpellDict);

    // Confirm that the combat character received these spell abilities
    expect(combatChar.abilities.some(a => a.id === 'spiritual-weapon')).toBe(true);
    expect(combatChar.abilities.some(a => a.id === 'spirit-guardians')).toBe(true);

    // Confirm spell slots carried over
    expect(combatChar.spellSlots?.level_2.max).toBe(3);
    expect(combatChar.spellSlots?.level_3.max).toBe(2);
  });
});
