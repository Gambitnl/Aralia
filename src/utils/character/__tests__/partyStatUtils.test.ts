import { describe, it, expect } from 'vitest';
import { createMockItem } from '../../core/factories';
import { ItemType } from '../../../types';
import { calculateAttackBonuses, calculateInitiativeModifier, formatInitiativeModifier, getMovementSpeed } from '../partyStatUtils';
import { applyFeatToCharacter } from '../progression';
import { FEATS_DATA } from '../../../data/feats/featsData';
import type { PlayerCharacter, AbilityScoreName } from '../../../types';

function createMockCharacter(overrides: Partial<PlayerCharacter> = {}): PlayerCharacter {
  const scores = overrides.finalAbilityScores ?? {
    Strength: 10,
    Dexterity: 16,
    Constitution: 14,
    Intelligence: 10,
    Wisdom: 10,
    Charisma: 10,
  };
  return {
    id: 'mock-pc-1',
    name: 'Initiative Hero',
    level: 1,
    proficiencyBonus: 2,
    hp: 10,
    maxHp: 10,
    abilityScores: { ...scores },
    baseAbilityScores: { ...scores },
    finalAbilityScores: { ...scores },
    race: {
      id: 'human',
      name: 'Human',
      abilityBonuses: [],
      traits: [],
      description: 'Human',
    },
    equippedItems: {},
    inventory: [],
    class: {
      id: 'fighter',
      name: 'Fighter',
      hitDie: 10,
      savingThrows: ['Strength', 'Constitution'] as AbilityScoreName[],
      armorProficiencies: ['light', 'medium', 'heavy', 'shields'],
      weaponProficiencies: ['simple', 'martial'],
      spellcasting: undefined,
    },
    skills: [],
    ...overrides,
  } as PlayerCharacter;
}

describe('calculateInitiativeModifier (agora-b6c9 / GG-456)', () => {
  it('calculates ordinary DEX initiative modifier for a character without Alert at levels 1 and 13', () => {
    const level1Char = createMockCharacter({
      level: 1,
      proficiencyBonus: 2,
      finalAbilityScores: { Strength: 10, Dexterity: 16, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
    });
    expect(calculateInitiativeModifier(level1Char)).toBe(3);

    const level13Char = createMockCharacter({
      level: 13,
      proficiencyBonus: 5,
      finalAbilityScores: { Strength: 10, Dexterity: 16, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
    });
    expect(calculateInitiativeModifier(level13Char)).toBe(3);
  });

  it('keeps Alert initiative proficiency scaled and additive to Dexterity at levels 1 and 13', () => {
    const alertFeat = FEATS_DATA.find(f => f.id === 'alert');
    expect(alertFeat).toBeDefined();

    // Level 1 character with 16 DEX (+3) and Alert feat
    const level1Base = createMockCharacter({
      level: 1,
      proficiencyBonus: 2,
      finalAbilityScores: { Strength: 10, Dexterity: 16, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
    });
    const level1Alert = applyFeatToCharacter(level1Base, alertFeat!);
    expect(level1Alert.initiativeProficiency).toBe(true);
    // Alert should NOT bake PB into a flat initiativeBonus number
    expect(level1Alert.initiativeBonus).toBeUndefined();
    // DEX (+3) + PB (+2) = 5
    expect(calculateInitiativeModifier(level1Alert)).toBe(5);

    // Level 13 character with 16 DEX (+3) and Alert feat
    const level13Base = createMockCharacter({
      level: 13,
      proficiencyBonus: 5,
      finalAbilityScores: { Strength: 10, Dexterity: 16, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
    });
    const level13Alert = applyFeatToCharacter(level13Base, alertFeat!);
    expect(level13Alert.initiativeProficiency).toBe(true);
    // DEX (+3) + PB (+5) = 8
    expect(calculateInitiativeModifier(level13Alert)).toBe(8);
  });

  it('correctly adds Alert proficiency bonus when Dexterity modifier is negative', () => {
    const alertFeat = FEATS_DATA.find(f => f.id === 'alert');
    const clumsyChar = createMockCharacter({
      level: 1,
      proficiencyBonus: 2,
      finalAbilityScores: { Strength: 10, Dexterity: 8, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 }, // DEX 8 = -1
    });
    const clumsyAlert = applyFeatToCharacter(clumsyChar, alertFeat!);
    // DEX (-1) + PB (+2) = 1
    expect(calculateInitiativeModifier(clumsyAlert)).toBe(1);

    const level13Clumsy = { ...clumsyAlert, level: 13, proficiencyBonus: 5 };
    // DEX (-1) + PB (+5) = 4
    expect(calculateInitiativeModifier(level13Clumsy)).toBe(4);
  });

  it('supports flat initiative bonuses (e.g. items or legacy feats) additively with DEX and proficiency', () => {
    // 14 DEX (+2) with flat +5 bonus
    const flatBonusChar = createMockCharacter({
      finalAbilityScores: { Strength: 10, Dexterity: 14, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
      initiativeBonus: 5,
    });
    // DEX (+2) + Flat (+5) = 7
    expect(calculateInitiativeModifier(flatBonusChar)).toBe(7);

    // 14 DEX (+2) with flat +2 bonus AND initiative proficiency (level 5, PB +3)
    const combinedChar = createMockCharacter({
      level: 5,
      proficiencyBonus: 3,
      finalAbilityScores: { Strength: 10, Dexterity: 14, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
      initiativeProficiency: true,
      initiativeBonus: 2,
    });
    // DEX (+2) + PB (+3) + Flat (+2) = 7
    expect(calculateInitiativeModifier(combinedChar)).toBe(7);
  });
});

describe('formatInitiativeModifier', () => {
  it('formats positive, zero, and negative modifiers correctly', () => {
    expect(formatInitiativeModifier(5)).toBe('+5');
    expect(formatInitiativeModifier(0)).toBe('+0');
    expect(formatInitiativeModifier(-1)).toBe('-1');
  });
});

describe('party walking speed used to plan combat', () => {
  it.each([['exhaustion', 25], ['exhaustion_2', 20], ['exhaustion_5', 5]])(
    'shows the combat movement allowance for %s without rewriting the saved base speed', (condition, expected) => {
      const character = createMockCharacter({ speed: 30, conditions: [condition] });
      expect(getMovementSpeed(character)).toBe(expected);
      expect(character.speed).toBe(30);
      expect(character.conditions).toEqual([condition]);
    });
  it('keeps an unexhausted speed and clamps an exhausted slow character at zero', () => {
    expect(getMovementSpeed(createMockCharacter({ speed: 35 }))).toBe(35);
    expect(getMovementSpeed(createMockCharacter({ speed: 10, conditions: ['exhaustion_3'] }))).toBe(0);
  });
});


describe('preparation attack totals agree with training and the displayed number', () => {
  const rapier = createMockItem({ id: 'rapier', name: 'Rapier', type: ItemType.Weapon,
    category: 'Martial Melee', properties: ['Finesse'] });
  function simpleTrained(overrides: Partial<PlayerCharacter> = {}) {
    const character = createMockCharacter();
    return createMockCharacter({ ...character,
      class: { ...character.class, weaponProficiencies: ['simple'] },
      finalAbilityScores: { ...character.finalAbilityScores, Dexterity: 14, Charisma: 8 },
      equippedItems: { MainHand: rapier }, ...overrides });
  }
  it('shows Sana’s untrained rapier without adding proficiency or changing equipment', () => {
    const character = simpleTrained();
    expect(calculateAttackBonuses(character).melee).toMatchObject({bonus: 2, bonusString: '+2', source: 'Rapier'});
    expect(character.equippedItems.MainHand).toBe(rapier);
  });
  it('retains training granted outside the primary class and magical bonuses', () => {
    const trained = simpleTrained({ weaponProficiencies: ['rapier'],
      equippedItems: { MainHand: {...rapier, magicProperties: { magicalBonus: 1, rarity: 'Common', category: 'Weapon', isIdentified: true }} } });
    expect(calculateAttackBonuses(trained).melee?.bonus).toBe(5);
  });
  it('keeps proficiency for unarmed strikes and Tavern Brawler improvised attacks', () => {
    expect(calculateAttackBonuses(simpleTrained({equippedItems: {}})).melee?.bonus).toBe(2);
    const stool = createMockItem({ type: ItemType.Weapon, category: 'Improvised', name: 'Stool' });
    expect(calculateAttackBonuses(simpleTrained({feats: ['tavern_brawler'], equippedItems: {MainHand: stool}})).melee?.bonus).toBe(2);
  });
  it('omits proficiency for an untrained equipped ranged weapon', () => {
    const bow = createMockItem({type: ItemType.Weapon, category: 'Martial Ranged', properties: ['Ammunition'], name: 'Longbow'});
    expect(calculateAttackBonuses(simpleTrained({equippedItems: {MainHand: bow}})).ranged).toMatchObject({bonus: 2, bonusString: '+2', source: 'Longbow'});
  });
  it.each([[8, 1, '+1'], [14, 4, '+4'], [6, 0, '+0'], [4, -1, '-1']])(
    'formats a Charisma %i spell attack as its total', (score, bonus, bonusString) => {
      const character = simpleTrained({spellcastingAbility: 'charisma'});
      character.finalAbilityScores.Charisma = score;
      expect(calculateAttackBonuses(character).spell).toMatchObject({bonus, bonusString});
    });
});


describe('roster names only attacks available from the equipped weapon', () => {
  it('does not offer a theoretical ranged attack for a rapier or empty hands', () => {
    const rapier=createMockItem({id:'rapier',name:'Rapier',type:ItemType.Weapon,category:'Martial Melee',properties:['Finesse']});
    expect(calculateAttackBonuses(createMockCharacter({equippedItems:{MainHand:rapier}})).ranged).toBeNull();
    expect(calculateAttackBonuses(createMockCharacter()).ranged).toBeNull();
  });
  it('shows a bow with Dexterity and does not label it as a melee attack', () => {
    const bow=createMockItem({id:'longbow',name:'Longbow',type:ItemType.Weapon,category:'Martial Ranged',properties:[]});
    const bonuses=calculateAttackBonuses(createMockCharacter({equippedItems:{MainHand:bow}}));
    expect(bonuses.ranged).toMatchObject({bonus:5,source:'Longbow'});
    expect(bonuses.melee).toBeNull();
  });
  it.each([['Javelin', ['Thrown'], 2], ['Dagger', ['Thrown','Finesse'], 5]])(
    'keeps the existing Strength/finesse rule when throwing %s', (name,properties,bonus) => {
      const weapon=createMockItem({id:name.toLowerCase(),name,type:ItemType.Weapon,category:'Simple Melee',properties});
      expect(calculateAttackBonuses(createMockCharacter({equippedItems:{MainHand:weapon}})).ranged).toMatchObject({bonus,source:name});
    });
});


describe('world-paced Longstrider and exhaustion', () => {
  const effect={id:'ooc-longstrider-caster',name:'Longstrider',source:'Longstrider',sourceCasterId:'caster',type:'buff' as const,duration:600,
    effect:{type:'stat_modifier' as const,stat:'speed' as const,value:10},worldTime:{appliedAtMs:0,expiresAtMs:3600000}};
  it('adds the temporary bonus before the unchanged exhaustion penalty and preserves saved speed', () => {
    const character=createMockCharacter({speed:30,conditions:['exhaustion'],statusEffects:[effect]});
    expect(getMovementSpeed(character)).toBe(35);expect(character.speed).toBe(30);
  });
  it('does not bring untracked combat turn riders into permanent exploration pace', () => {
    const {worldTime: _clock,...turnRider}=effect;
    expect(getMovementSpeed(createMockCharacter({speed:30,statusEffects:[turnRider]}))).toBe(30);
  });
});
