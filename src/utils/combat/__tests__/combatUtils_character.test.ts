
import { describe, it, expect } from 'vitest';
import { createPlayerCombatCharacter } from '../../combat/combatUtils';
import { CLASSES_DATA } from '../../../data/classes';
import { Item } from '../../../types';
import { Spell, SpellSchool } from '../../../types/spells';
import { createMockPlayerCharacter, createMockSpell } from '../../core/factories';

// Mocks
const mockAllSpells: Record<string, Spell> = {
  'fireball': createMockSpell({
    id: 'fireball',
    name: 'Fireball',
    level: 3,
    school: SpellSchool.Evocation,
    castingTime: { value: 1, unit: 'action' },
    range: { type: 'ranged', distance: 150 },
    effects: [{
        type: 'DAMAGE',
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
    // baseInitiative is the NON-Dex part (no bonuses/proficiency here → 0).
    // Dex is added by rollInitiative; baking it in here double-counted it.
    expect(combatChar.stats.baseInitiative).toBe(0);
  });

  it('gives an unarmored monk +10 speed (Unarmored Movement) at level 2+', () => {
    const baseSpeed = createPlayerCombatCharacter(
      createMockPlayerCharacter({ class: CLASSES_DATA['monk'], level: 1, equippedItems: {} }),
    ).stats.speed;
    const l2Monk = createPlayerCombatCharacter(
      createMockPlayerCharacter({ class: CLASSES_DATA['monk'], level: 2, equippedItems: {} }),
    );
    expect(l2Monk.stats.speed).toBe(baseSpeed + 10);
    expect(l2Monk.actionEconomy.movement.total).toBe(l2Monk.stats.speed);
  });

  it('gives a barbarian Danger Sense (Dex-save advantage) at level 2+, not level 1', () => {
    const hasDangerSense = (c: ReturnType<typeof createPlayerCombatCharacter>) =>
      (c.modifiers?.advantage ?? []).some(a => /dexterity saving throw/i.test(a));
    const l1 = createPlayerCombatCharacter(createMockPlayerCharacter({ class: CLASSES_DATA['barbarian'], level: 1 }));
    const l2 = createPlayerCombatCharacter(createMockPlayerCharacter({ class: CLASSES_DATA['barbarian'], level: 2 }));
    const fighter = createPlayerCombatCharacter(createMockPlayerCharacter({ class: CLASSES_DATA['fighter'], level: 2 }));
    expect(hasDangerSense(l1)).toBe(false);
    expect(hasDangerSense(l2)).toBe(true);
    expect(hasDangerSense(fighter)).toBe(false);
  });

  it('gives a level-3 Champion an Improved Critical threshold of 19', () => {
    const champion = createPlayerCombatCharacter(
      createMockPlayerCharacter({ class: CLASSES_DATA['fighter'], level: 3, subclassId: 'champion' }),
    );
    expect(champion.critThreshold).toBe(19);
  });

  it('leaves the crit threshold at 20 for non-Champions and low-level Champions', () => {
    const plainFighter = createPlayerCombatCharacter(
      createMockPlayerCharacter({ class: CLASSES_DATA['fighter'], level: 3, subclassId: 'battle_master' }),
    );
    const youngChampion = createPlayerCombatCharacter(
      createMockPlayerCharacter({ class: CLASSES_DATA['fighter'], level: 1, subclassId: 'champion' }),
    );
    expect(plainFighter.critThreshold).toBe(20);
    expect(youngChampion.critThreshold).toBe(20);
  });

  it('grants rogue Cunning Dash only at level 2+, not level 1', () => {
    const rogueClass = CLASSES_DATA['rogue'];
    const lvl1 = createPlayerCombatCharacter(
      createMockPlayerCharacter({ class: rogueClass, level: 1 }),
    );
    const lvl2 = createPlayerCombatCharacter(
      createMockPlayerCharacter({ class: rogueClass, level: 2 }),
    );
    expect(lvl1.abilities.some(a => a.id === 'cunning_dash')).toBe(false);
    expect(lvl2.abilities.some(a => a.id === 'cunning_dash')).toBe(true);
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
      level: 2, // Cunning Action / Cunning Dash is a level-2 rogue feature
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

  it('should include limited-use class features for Barbarian and Bard', () => {
    const barbarian = createMockPlayerCharacter({
      class: CLASSES_DATA.barbarian,
      classLevels: { barbarian: 1 },
      level: 1,
      limitedUses: {
        rage: {
          name: 'Rage',
          current: 2,
          max: 2,
          resetOn: 'long_rest'
        }
      }
    });

    const barbarianCombat = createPlayerCombatCharacter(barbarian);
    const rage = barbarianCombat.abilities.find(a => a.id === 'rage');

    expect(rage).toBeDefined();
    expect(rage?.cost.type).toBe('bonus');
    expect(rage?.usesRemaining).toBe(2);
    expect(rage?.maxUses).toBe(2);

    const bard = createMockPlayerCharacter({
      class: CLASSES_DATA.bard,
      classLevels: { bard: 1 },
      level: 1,
      limitedUses: {
        bardic_inspiration: {
          name: 'Bardic Inspiration',
          current: 3,
          max: 3,
          resetOn: 'long_rest'
        }
      }
    });

    const bardCombat = createPlayerCombatCharacter(bard);
    const bardicInspiration = bardCombat.abilities.find(a => a.id === 'bardic_inspiration');

    expect(bardicInspiration).toBeDefined();
    expect(bardicInspiration?.cost.type).toBe('bonus');
    expect(bardicInspiration?.usesRemaining).toBe(3);
    expect(bardicInspiration?.maxUses).toBe(3);
  });

  it('should include missing class features for Monk, Paladin, and Warlock', () => {
    const monk = createMockPlayerCharacter({
      class: CLASSES_DATA.monk,
      classLevels: { monk: 2 },
      level: 2,
    });
    const monkCombat = createPlayerCombatCharacter(monk);
    const flurry = monkCombat.abilities.find(a => a.id === 'flurry_of_blows');

    expect(flurry).toBeDefined();
    expect(flurry?.cost.type).toBe('bonus');

    const paladin = createMockPlayerCharacter({
      class: CLASSES_DATA.paladin,
      classLevels: { paladin: 2 },
      level: 2,
      // Divine Smite is now a real weapon attack, so it needs an equipped weapon
      // (paladins get one from their starting loadout).
      equippedItems: { MainHand: { id: 'longsword', name: 'Longsword', type: 'weapon', damageDice: '1d8', slot: 'MainHand' } as never },
    });
    const paladinCombat = createPlayerCombatCharacter(paladin);
    const divineSmite = paladinCombat.abilities.find(a => a.id === 'divine_smite');

    expect(divineSmite).toBeDefined();
    expect(divineSmite?.type).toBe('attack'); // rolls to hit + adds radiant, not inert

    const warlock = createMockPlayerCharacter({
      class: CLASSES_DATA.warlock,
      classLevels: { warlock: 1 },
      level: 1,
    });
    const warlockCombat = createPlayerCombatCharacter(warlock);
    const pactMagic = warlockCombat.abilities.find(a => a.id === 'pact_magic');

    expect(pactMagic).toBeDefined();
    expect(pactMagic?.type).toBe('utility');
  });

  it('should convert prepared spells into abilities', () => {
     const player = createMockPlayerCharacter({
         spellbook: {
             preparedSpells: ['fireball'],
             cantrips: [],
             knownSpells: []
         } as any
     });

     const combatChar = createPlayerCombatCharacter(player, mockAllSpells);
     const fireball = combatChar.abilities.find(a => a.name === 'Fireball');

     expect(fireball).toBeDefined();
     expect(fireball?.type).toBe('spell');
  });
});
