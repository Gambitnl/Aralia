
import { describe, it, expect, vi } from 'vitest';
import { createPlayerCombatCharacter } from '../combatUtils';
import { PlayerCharacter, Item } from '../../types';
import { Spell } from '../../types/spells';
import { createMockPlayerCharacter, createMockSpell } from '../factories';

// Mocks
const mockAllSpells: Record<string, Spell> = {
  'fireball': createMockSpell({
    id: 'fireball',
    name: 'Fireball',
    level: 3,
    school: 'Evocation',
    castingTime: { value: 1, unit: 'action' },
    range: { type: 'ranged', distance: 150 },
    effects: [{
        type: 'damage',
        trigger: { type: 'immediate' },
        condition: { type: 'hit' },
        damage: { dice: '8d6', type: 'fire' }
    }]
  })
};

describe('combatUtils: createPlayerCombatCharacter', () => {
  it('should create a basic combat character from player data', () => {
    const player = createMockPlayerCharacter({
      name: 'Hero',
      hp: 25,
      maxHp: 30,
      finalAbilityScores: {
        Strength: 16,
        Dexterity: 14,
        Constitution: 14,
        Intelligence: 10,
        Wisdom: 12,
        Charisma: 10
      },
      speed: 30,
      class: {
        id: 'fighter',
        name: 'Fighter',
        hitDie: 10,
        primaryAbility: ['Strength'],
        savingThrowProficiencies: ['Strength', 'Constitution'],
        skillProficienciesAvailable: [],
        numberOfSkillProficiencies: 2,
        armorProficiencies: [],
        weaponProficiencies: [],
        features: [],
        description: 'Fighter'
      }
    });

    const combatChar = createPlayerCombatCharacter(player);

    expect(combatChar.name).toBe('Hero');
    expect(combatChar.currentHP).toBe(25);
    expect(combatChar.maxHP).toBe(30);
    expect(combatChar.stats.strength).toBe(16);
    expect(combatChar.stats.dexterity).toBe(14);
    // Base initiative should be Dex mod: (14-10)/2 = 2
    expect(combatChar.stats.baseInitiative).toBe(2);
  });

  it('should generate unarmed strike when no weapons are equipped', () => {
    const player = createMockPlayerCharacter({ equippedItems: {} });
    const combatChar = createPlayerCombatCharacter(player);

    const unarmed = combatChar.abilities.find(a => a.id === 'unarmed_strike');
    expect(unarmed).toBeDefined();
    expect(unarmed?.name).toBe('Unarmed Strike');
    // Str 10 -> Mod 0. 1 + 0 = 1 damage
    expect(unarmed?.effects[0].value).toBe(1);
  });

  it('should generate weapon abilities for equipped items', () => {
    const longsword: Item = {
      id: 'longsword',
      name: 'Longsword',
      type: 'weapon',
      properties: [],
      description: 'A sharp blade.',
      category: 'Martial Weapon',
      weight: 3,
      value: 15
    };

    const player = createMockPlayerCharacter({
      equippedItems: { MainHand: longsword }
    });

    const combatChar = createPlayerCombatCharacter(player);
    const attack = combatChar.abilities.find(a => a.id === 'attack_main');

    expect(attack).toBeDefined();
    expect(attack?.name).toBe('Longsword');
    expect(attack?.cost.type).toBe('action');
  });

  it('should generate offhand attack with bonus action cost', () => {
    const dagger: Item = {
      id: 'dagger',
      name: 'Dagger',
      type: 'weapon',
      properties: ['light', 'finesse'],
      description: 'A small blade.',
      category: 'Simple Weapon',
      weight: 1,
      value: 2
    };

    const player = createMockPlayerCharacter({
        equippedItems: { OffHand: dagger }
    });

    const combatChar = createPlayerCombatCharacter(player);
    const attack = combatChar.abilities.find(a => a.id === 'attack_off');

    expect(attack).toBeDefined();
    expect(attack?.name).toBe('Dagger');
    expect(attack?.cost.type).toBe('bonus');
  });

  it('should include class features like Cunning Dash for Rogues', () => {
    const player = createMockPlayerCharacter({
      class: {
        id: 'rogue',
        name: 'Rogue',
        hitDie: 8,
        primaryAbility: ['Dexterity'],
        savingThrowProficiencies: ['Dexterity', 'Intelligence'],
        skillProficienciesAvailable: [],
        numberOfSkillProficiencies: 4,
        armorProficiencies: [],
        weaponProficiencies: [],
        features: [],
        description: 'Rogue'
      }
    });

    const combatChar = createPlayerCombatCharacter(player);
    const cunningDash = combatChar.abilities.find(a => a.id === 'cunning_dash');

    expect(cunningDash).toBeDefined();
    expect(cunningDash?.cost.type).toBe('bonus');
  });

  it('should convert prepared spells into abilities', () => {
     const player = createMockPlayerCharacter({
         spellbook: {
             preparedSpells: ['fireball'],
             cantrips: [],
             knownSpells: [],
             slots: { 1: { total: 2, used: 0 } }
         }
     });

     const combatChar = createPlayerCombatCharacter(player, mockAllSpells);
     const fireball = combatChar.abilities.find(a => a.name === 'Fireball');

     expect(fireball).toBeDefined();
     expect(fireball?.type).toBe('spell');
  });
});
