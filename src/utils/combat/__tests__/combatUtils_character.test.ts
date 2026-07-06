
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

  it('gives a level-3 Draconic sorcerer an unarmored AC of 10 + Dex + Cha (Draconic Resilience)', () => {
    // Dex 16 (+3), Cha 18 (+4) -> unarmored AC 10 + 3 + 4 = 17, HP max +3 (level).
    const draconic = createPlayerCombatCharacter(
      createMockPlayerCharacter({
        class: CLASSES_DATA['sorcerer'], level: 3, subclassId: 'draconic',
        equippedItems: {},
        maxHp: 20, hp: 20,
        finalAbilityScores: { Strength: 8, Dexterity: 16, Constitution: 14, Intelligence: 10, Wisdom: 10, Charisma: 18 },
      }),
    );
    expect(draconic.armorClass).toBe(17);
    expect(draconic.baseAC).toBe(17);
    expect(draconic.maxHP).toBe(23); // 20 + level(3)
    expect(draconic.currentHP).toBe(23);
  });

  it('does not grant Draconic Resilience to a Wild Magic sorcerer or a low-level Draconic sorcerer', () => {
    const wildMagic = createPlayerCombatCharacter(
      createMockPlayerCharacter({ class: CLASSES_DATA['sorcerer'], level: 3, subclassId: 'wild_magic', equippedItems: {}, armorClass: 10 }),
    );
    const youngDraconic = createPlayerCombatCharacter(
      createMockPlayerCharacter({ class: CLASSES_DATA['sorcerer'], level: 1, subclassId: 'draconic', equippedItems: {}, armorClass: 10 }),
    );
    expect(wildMagic.armorClass).toBe(10);
    expect(youngDraconic.armorClass).toBe(10);
  });

  it('grants an Oath of Vengeance paladin the Vow of Enmity ability at level 3', () => {
    const vengeance = createPlayerCombatCharacter(
      createMockPlayerCharacter({ class: CLASSES_DATA['paladin'], level: 3, subclassId: 'oath_of_vengeance' }),
    );
    const devotion = createPlayerCombatCharacter(
      createMockPlayerCharacter({ class: CLASSES_DATA['paladin'], level: 3, subclassId: 'oath_of_devotion' }),
    );
    const vow = vengeance.abilities.find(a => a.id === 'vow_of_enmity');
    expect(vow).toBeDefined();
    expect(vow?.cost.type).toBe('bonus');
    expect(devotion.abilities.some(a => a.id === 'vow_of_enmity')).toBe(false);
  });

  it('grants a Berserker barbarian the Frenzy bonus-action weapon attack at level 3', () => {
    const weapon = { id: 'greataxe', name: 'Greataxe', type: 'weapon', damageDice: '1d12', category: 'Martial Weapon', slot: 'MainHand' } as unknown as Item;
    const berserker = createPlayerCombatCharacter(
      createMockPlayerCharacter({ class: CLASSES_DATA['barbarian'], level: 3, subclassId: 'berserker', equippedItems: { MainHand: weapon } }),
    );
    const wildHeart = createPlayerCombatCharacter(
      createMockPlayerCharacter({ class: CLASSES_DATA['barbarian'], level: 3, subclassId: 'wild_heart', equippedItems: { MainHand: weapon } }),
    );
    const frenzy = berserker.abilities.find(a => a.id === 'frenzy_attack');
    expect(frenzy).toBeDefined();
    expect(frenzy?.type).toBe('attack'); // rolls to hit + weapon damage, not inert
    expect(frenzy?.cost.type).toBe('bonus');
    expect(frenzy?.effects[0].dice).toBe('1d12');
    // Wild Heart barbarian does NOT get Frenzy.
    expect(wildHeart.abilities.some(a => a.id === 'frenzy_attack')).toBe(false);
  });

  it('tags a Wild Heart barbarian Rage with the bear-spirit boon at level 3', () => {
    const wildHeart = createPlayerCombatCharacter(
      createMockPlayerCharacter({ class: CLASSES_DATA['barbarian'], level: 3, subclassId: 'wild_heart' }),
    );
    const berserker = createPlayerCombatCharacter(
      createMockPlayerCharacter({ class: CLASSES_DATA['barbarian'], level: 3, subclassId: 'berserker' }),
    );
    const wildHeartRage = wildHeart.abilities.find(a => a.id === 'rage');
    expect(wildHeartRage?.tags).toContain('wild_heart_bear');
    // A different subclass's Rage is untagged (base physical resistance only).
    expect(berserker.abilities.find(a => a.id === 'rage')?.tags ?? []).not.toContain('wild_heart_bear');
  });

  it("resolves a level-3 Fiend warlock's Dark One's Blessing temp HP (Cha mod + warlock level)", () => {
    // Cha 16 (+3) + warlock level 3 = 6 temporary hit points on each kill.
    const fiend = createPlayerCombatCharacter(
      createMockPlayerCharacter({
        class: CLASSES_DATA['warlock'], level: 3, subclassId: 'fiend',
        finalAbilityScores: { Strength: 8, Dexterity: 14, Constitution: 14, Intelligence: 10, Wisdom: 10, Charisma: 16 },
      }),
    );
    expect(fiend.darkOnesBlessingTempHp).toBe(6);
  });

  it("floors Dark One's Blessing at a minimum of 1 temp HP when the Charisma modifier is negative", () => {
    // Cha 8 (-1) + warlock level 3 = 2, still positive; use Cha 6 (-2) + a
    // hypothetical low level is impossible (level 3 min), so verify the floor
    // holds by construction with a very low Charisma at exactly level 3:
    // Cha 4 (-3) + 3 = 0 -> clamped to 1.
    const fiend = createPlayerCombatCharacter(
      createMockPlayerCharacter({
        class: CLASSES_DATA['warlock'], level: 3, subclassId: 'fiend',
        finalAbilityScores: { Strength: 8, Dexterity: 14, Constitution: 14, Intelligence: 10, Wisdom: 10, Charisma: 4 },
      }),
    );
    expect(fiend.darkOnesBlessingTempHp).toBe(1);
  });

  it("does not grant Dark One's Blessing to a non-Fiend warlock or a low-level Fiend warlock", () => {
    const archfey = createPlayerCombatCharacter(
      createMockPlayerCharacter({ class: CLASSES_DATA['warlock'], level: 3, subclassId: 'archfey' }),
    );
    const youngFiend = createPlayerCombatCharacter(
      createMockPlayerCharacter({ class: CLASSES_DATA['warlock'], level: 1, subclassId: 'fiend' }),
    );
    expect(archfey.darkOnesBlessingTempHp).toBeUndefined();
    expect(youngFiend.darkOnesBlessingTempHp).toBeUndefined();
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
