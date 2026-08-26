

/**
 * @file src/data/classes/index.ts
 * Defines all class data for the Aralia RPG.
 */
import { Class as CharClass, FightingStyle, SelectableClass } from '../../types/index.js';
import { SUBCLASSES } from './subclasses.js';
// Per-class spell lists are GENERATED from the `classes` array inside every
// spell JSON under public/data/spells, so a new spell reaches its class without
// a second hand edit here. Regenerate with:
//   node scripts/generate-class-spell-lists.mjs
// Staleness fails `npm run validate:class-spell-lists`.
import {
  ARTIFICER_SPELL_LIST,
  BARD_SPELL_LIST,
  CLERIC_SPELL_LIST,
  DRUID_SPELL_LIST,
  PALADIN_SPELL_LIST,
  RANGER_SPELL_LIST,
  SORCERER_SPELL_LIST,
  WARLOCK_SPELL_LIST,
  WIZARD_SPELL_LIST,
} from './spellLists.generated.js';

const FIGHTING_STYLES_DATA: Record<string, FightingStyle> = {
  'archery': { id: 'archery', name: 'Archery', description: '+2 bonus to attack rolls with ranged weapons.', levelAvailable: 1 },
  'defense': { id: 'defense', name: 'Defense', description: '+1 bonus to AC while wearing armor.', levelAvailable: 1 },
  'dueling': { id: 'dueling', name: 'Dueling', description: '+2 damage with a melee weapon in one hand and no other weapon.', levelAvailable: 1 },
  'great_weapon_fighting': { id: 'great_weapon_fighting', name: 'Great Weapon Fighting', description: 'Reroll 1s and 2s on damage dice with two-handed melee weapons.', levelAvailable: 1 },
  'two_weapon_fighting': { id: 'two_weapon_fighting', name: 'Two-Weapon Fighting', description: 'When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.', levelAvailable: 1 },
  'druidic_warrior': { id: 'druidic_warrior', name: 'Druidic Warrior', description: 'You learn two cantrips of your choice from the druid spell list. Wisdom is your spellcasting ability for them.', levelAvailable: 1 }
};



export const CLASSES_DATA: Record<string, CharClass> = {
  'fighter': {
    id: 'fighter', name: 'Fighter', description: 'Masters of combat, skilled with a variety of weapons and armor.',
    hitDie: 10, primaryAbility: ['Strength', 'Dexterity'], savingThrowProficiencies: ['Strength', 'Constitution'],
    skillProficienciesAvailable: ['acrobatics', 'animal_handling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'],
    numberOfSkillProficiencies: 2,
    armorProficiencies: ['All armor', 'Shields'], weaponProficiencies: ['Simple weapons', 'Martial weapons'],
    features: [
      { id: 'second_wind', name: 'Second Wind', description: 'Regain hit points as a bonus action.', levelAvailable: 1 },
    ],
    weaponMasterySlots: 3,
    fightingStyles: Object.values(FIGHTING_STYLES_DATA).filter(s => s.id !== 'druidic_warrior'), // Exclude Druidic Warrior for Fighter
    statRecommendationFocus: ['Strength', 'Dexterity', 'Constitution'],
    statRecommendationDetails: "Prioritize Strength (for heavy weapons/armor) OR Dexterity (for finesse/ranged weapons). Constitution is vital for hit points. Choose based on your intended combat style and selected Fighting Style.",
    recommendedPointBuyPriorities: ['Strength', 'Constitution', 'Dexterity', 'Wisdom', 'Charisma', 'Intelligence'], // Example, could vary based on common fighter builds
  },
  'barbarian': {
    id: 'barbarian', name: 'Barbarian', description: 'A fierce warrior who can enter a battle rage.',
    hitDie: 12, primaryAbility: ['Strength'], savingThrowProficiencies: ['Strength', 'Constitution'],
    skillProficienciesAvailable: ['animal_handling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'],
    numberOfSkillProficiencies: 2,
    armorProficiencies: ['Light armor', 'Medium armor', 'Shields'], weaponProficiencies: ['Simple weapons', 'Martial weapons'],
    features: [
      { id: 'rage', name: 'Rage', description: 'Enter a rage as a bonus action.', levelAvailable: 1 },
      { id: 'unarmored_defense_barbarian', name: 'Unarmored Defense', description: 'While not wearing armor, your AC equals 10 + your Dexterity modifier + your Constitution modifier.', levelAvailable: 1 }
    ],
    weaponMasterySlots: 2,
    statRecommendationFocus: ['Strength', 'Constitution'],
    statRecommendationDetails: 'Strength fuels your rage and attacks. Constitution makes you tougher and boosts your AC without armor.',
    recommendedPointBuyPriorities: ['Strength', 'Constitution', 'Dexterity', 'Wisdom', 'Intelligence', 'Charisma'],
  },
  'bard': {
    id: 'bard', name: 'Bard', description: 'A master of song, speech, and the magic they contain, Bards use their artistic talents to work magic and inspire allies.',
    hitDie: 8, primaryAbility: ['Charisma'], savingThrowProficiencies: ['Dexterity', 'Charisma'],
    skillProficienciesAvailable: ['acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception', 'history', 'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception', 'performance', 'persuasion', 'religion', 'sleight_of_hand', 'stealth', 'survival'],
    numberOfSkillProficiencies: 3,
    armorProficiencies: ['Light armor'], weaponProficiencies: ['Simple weapons'],
    features: [{ id: 'bardic_inspiration', name: 'Bardic Inspiration', description: 'Inspire others through stirring words or music.', levelAvailable: 1 }],
    spellcasting: { ability: 'Charisma', knownCantrips: 2, knownSpellsL1: 4, spellList: BARD_SPELL_LIST },
    statRecommendationFocus: ['Charisma', 'Dexterity', 'Constitution'],
    statRecommendationDetails: "Charisma is the heart of your spellcasting and class features. Dexterity helps with AC and finesse weapons. Constitution is important for concentration and health.",
    recommendedPointBuyPriorities: ['Charisma', 'Dexterity', 'Constitution', 'Wisdom', 'Intelligence', 'Strength'],
  },
  'cleric': {
    id: 'cleric', name: 'Cleric', description: 'Warriors of the gods, wielding divine magic.',
    hitDie: 8, primaryAbility: ['Wisdom'], savingThrowProficiencies: ['Wisdom', 'Charisma'],
    skillProficienciesAvailable: ['history', 'insight', 'medicine', 'persuasion', 'religion'],
    numberOfSkillProficiencies: 2,
    armorProficiencies: ['Light armor', 'Medium armor', 'Shields'], weaponProficiencies: ['Simple weapons'],
    features: [], // Divine Order is the main L1 choice, handled via divineOrders property
    divineOrders: [
      { id: 'Protector', name: 'Protector', description: 'Trained for battle, you gain proficiency with Martial weapons and Heavy armor.' },
      { id: 'Thaumaturge', name: 'Thaumaturge', description: 'You know one extra cantrip and gain a bonus to Arcana or Religion checks.' }
    ],
    spellcasting: { ability: 'Wisdom', knownCantrips: 3, knownSpellsL1: 4, spellList: CLERIC_SPELL_LIST },
    statRecommendationFocus: ['Wisdom', 'Constitution', 'Strength'],
    statRecommendationDetails: "Wisdom is crucial for your spellcasting. Constitution increases your survivability. Strength can be useful if you plan to engage in melee, especially with heavier armor from certain domains.",
    recommendedPointBuyPriorities: ['Wisdom', 'Constitution', 'Strength', 'Dexterity', 'Charisma', 'Intelligence'],
  },
  'druid': {
    id: 'druid', name: 'Druid', description: 'A priest of the Old Faith, wielding the powers of nature and adopting animal forms.',
    hitDie: 8, primaryAbility: ['Wisdom'], savingThrowProficiencies: ['Intelligence', 'Wisdom'],
    skillProficienciesAvailable: ['animal_handling', 'arcana', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'],
    numberOfSkillProficiencies: 2,
    armorProficiencies: ['Light armor', 'Medium armor', 'Shields'], weaponProficiencies: ['Simple weapons'],
    features: [{ id: 'druidic', name: 'Druidic', description: 'You know the secret language of druids and can leave hidden messages.', levelAvailable: 1 }],
    primalOrders: [
      { id: 'Magician', name: 'Magician', description: 'You know one extra cantrip from the Druid spell list.' },
      { id: 'Warden', name: 'Warden', description: 'You gain proficiency with Martial weapons and training with Medium armor.' }
    ],
    spellcasting: { ability: 'Wisdom', knownCantrips: 2, knownSpellsL1: 4, spellList: DRUID_SPELL_LIST },
    statRecommendationFocus: ['Wisdom', 'Constitution', 'Dexterity'],
    statRecommendationDetails: "Wisdom powers your spells and Wild Shape. Constitution helps maintain concentration. Dexterity boosts AC since you avoid metal armor.",
    recommendedPointBuyPriorities: ['Wisdom', 'Constitution', 'Dexterity', 'Intelligence', 'Strength', 'Charisma'],
  },
  'ranger': {
    id: 'ranger', name: 'Ranger', description: 'A warrior of the wilderness who uses martial prowess and nature magic to combat threats on the edges of civilization.',
    hitDie: 10, primaryAbility: ['Dexterity', 'Wisdom'], savingThrowProficiencies: ['Strength', 'Dexterity'],
    skillProficienciesAvailable: ['animal_handling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'],
    numberOfSkillProficiencies: 3,
    armorProficiencies: ['Light armor', 'Medium armor', 'Shields'],
    weaponProficiencies: ['Simple weapons', 'Martial weapons'],
    weaponMasterySlots: 2,
    features: [
      { id: 'favored_enemy_feature', name: 'Favored Enemy', description: 'You have significant experience studying, tracking, hunting, and even talking to a certain type of enemy.', levelAvailable: 1 },
      { id: 'deft_explorer_feature', name: 'Deft Explorer', description: 'You are an unsurpassed explorer and survivor.', levelAvailable: 1 },
    ],
    spellcasting: { ability: 'Wisdom', knownCantrips: 0, knownSpellsL1: 2, spellList: RANGER_SPELL_LIST },
    statRecommendationFocus: ['Dexterity', 'Wisdom', 'Constitution'],
    statRecommendationDetails: "Dexterity is key for ranged attacks and AC. Wisdom powers your spells. Constitution is important for health and concentration.",
    recommendedPointBuyPriorities: ['Dexterity', 'Constitution', 'Wisdom', 'Strength', 'Intelligence', 'Charisma'],
  },
  'rogue': {
    id: 'rogue', name: 'Rogue', description: 'A scoundrel who uses stealth and trickery to overcome obstacles and enemies.',
    hitDie: 8, primaryAbility: ['Dexterity'], savingThrowProficiencies: ['Dexterity', 'Intelligence'],
    skillProficienciesAvailable: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleight_of_hand', 'stealth', 'survival'],
    numberOfSkillProficiencies: 4,
    armorProficiencies: ['Light armor'],
    weaponProficiencies: ['Simple weapons', 'Hand crossbows', 'Longswords', 'Rapiers', 'Shortswords'],
    weaponMasterySlots: 2,
    features: [{ id: 'sneak_attack', name: 'Sneak Attack', description: 'Once per turn, you can deal extra damage to one creature you hit with an attack if you have advantage.', levelAvailable: 1 }],
    statRecommendationFocus: ['Dexterity', 'Constitution'],
    statRecommendationDetails: "Dexterity is your most important ability, affecting your attacks, AC, and many skills. Constitution helps you survive when your stealth fails.",
    recommendedPointBuyPriorities: ['Dexterity', 'Constitution', 'Wisdom', 'Charisma', 'Intelligence', 'Strength'],
  },
  'paladin': {
    id: 'paladin', name: 'Paladin', description: 'A holy warrior bound to a sacred oath.',
    hitDie: 10, primaryAbility: ['Strength', 'Charisma'], savingThrowProficiencies: ['Wisdom', 'Charisma'],
    skillProficienciesAvailable: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'],
    numberOfSkillProficiencies: 2,
    armorProficiencies: ['All armor', 'Shields'],
    weaponProficiencies: ['Simple weapons', 'Martial weapons'],
    weaponMasterySlots: 2,
    features: [{ id: 'divine_sense', name: 'Divine Sense', description: 'You can sense strong good or evil.', levelAvailable: 1 }],
    spellcasting: { ability: 'Charisma', knownCantrips: 0, knownSpellsL1: 2, spellList: PALADIN_SPELL_LIST },
    statRecommendationFocus: ['Strength', 'Charisma', 'Constitution'],
    statRecommendationDetails: "Strength is vital for your attacks and armor. Charisma powers your spells and class features. Constitution provides essential hit points.",
    recommendedPointBuyPriorities: ['Strength', 'Charisma', 'Constitution', 'Wisdom', 'Dexterity', 'Intelligence'],
  },
  'monk': {
    id: 'monk', name: 'Monk', description: 'A master of martial arts, harnessing the power of the body in pursuit of physical and spiritual perfection.',
    hitDie: 8, primaryAbility: ['Dexterity', 'Wisdom'], savingThrowProficiencies: ['Strength', 'Dexterity'],
    skillProficienciesAvailable: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'],
    numberOfSkillProficiencies: 2,
    armorProficiencies: [],
    weaponProficiencies: ['Simple weapons', 'Shortswords'],
    features: [{ id: 'unarmored_defense', name: 'Unarmored Defense', description: 'Your AC equals 10 + your Dexterity modifier + your Wisdom modifier.', levelAvailable: 1 }],
    weaponMasterySlots: 2,
    statRecommendationFocus: ['Dexterity', 'Wisdom', 'Constitution'],
    statRecommendationDetails: "Dexterity is crucial for your attacks and AC. Wisdom boosts your AC and powers your special abilities. Constitution is important for hit points.",
    recommendedPointBuyPriorities: ['Dexterity', 'Wisdom', 'Constitution', 'Strength', 'Charisma', 'Intelligence'],
  },
  'sorcerer': {
    id: 'sorcerer', name: 'Sorcerer', description: 'An innate spellcaster who draws on inherent magic from a gifted bloodline or other extraordinary event.',
    hitDie: 6, primaryAbility: ['Charisma'], savingThrowProficiencies: ['Constitution', 'Charisma'],
    skillProficienciesAvailable: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'],
    numberOfSkillProficiencies: 2,
    armorProficiencies: [],
    weaponProficiencies: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light crossbows'],
    features: [
      { id: 'innate_sorcery', name: 'Innate Sorcery', description: 'Unleash your innate magic for 1 minute, gaining bonuses to spell save DC and attack rolls.', levelAvailable: 1 }
    ],
    spellcasting: {
      ability: 'Charisma',
      knownCantrips: 4,
      knownSpellsL1: 2,
      spellList: SORCERER_SPELL_LIST,
    },
    statRecommendationFocus: ['Charisma', 'Constitution', 'Dexterity'],
    statRecommendationDetails: "Charisma is the key to your spellcasting. Constitution helps maintain concentration and provides hit points. Dexterity improves your Armor Class since you wear no armor.",
    recommendedPointBuyPriorities: ['Charisma', 'Constitution', 'Dexterity', 'Wisdom', 'Intelligence', 'Strength'],
  },
  'warlock': {
    id: 'warlock', name: 'Warlock', description: 'A wielder of magic derived from a bargain with an extraplanar entity.',
    hitDie: 8, primaryAbility: ['Charisma'], savingThrowProficiencies: ['Wisdom', 'Charisma'],
    skillProficienciesAvailable: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'],
    numberOfSkillProficiencies: 2,
    armorProficiencies: ['Light armor'], weaponProficiencies: ['Simple weapons'],
    // The patrons a warlock can swear to. WHEN the choice is made is the
    // rules-edition question (level 1 under the 2014 PHB, level 3 under 2024),
    // answered by getSubclassLevel in src/config/rulesEdition.ts — so the
    // options themselves are listed here unconditionally, sourced from the
    // same SUBCLASSES table the level-3 path uses.
    warlockPatrons: (SUBCLASSES.warlock ?? []).map(({ id, name, description }) => ({ id, name, description })),
    features: [{ id: 'pact_magic', name: 'Pact Magic', description: 'Your arcane research and the magic bestowed on you by your patron have given you facility with spells.', levelAvailable: 1 }],
    spellcasting: { ability: 'Charisma', knownCantrips: 2, knownSpellsL1: 2, spellList: WARLOCK_SPELL_LIST },
    statRecommendationFocus: ['Charisma', 'Constitution', 'Dexterity'],
    statRecommendationDetails: "Charisma fuels your powerful pact magic. Constitution is vital for maintaining concentration on your spells. Dexterity provides a bonus to AC.",
    recommendedPointBuyPriorities: ['Charisma', 'Constitution', 'Dexterity', 'Wisdom', 'Intelligence', 'Strength'],
  },
  'wizard': {
    id: 'wizard', name: 'Wizard', description: 'Scholarly magic-users capable of manipulating the fabric of reality.',
    hitDie: 6, primaryAbility: ['Intelligence'], savingThrowProficiencies: ['Intelligence', 'Wisdom'],
    skillProficienciesAvailable: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'],
    numberOfSkillProficiencies: 2,
    armorProficiencies: [], weaponProficiencies: ['Daggers', 'Darts', 'Slings', 'Quarterstaffs', 'Light crossbows'],
    features: [{ id: 'arcane_recovery', name: 'Arcane Recovery', description: 'Recover some spell slots during a short rest.', levelAvailable: 1 }],
    spellcasting: { ability: 'Intelligence', knownCantrips: 3, knownSpellsL1: 6, spellList: WIZARD_SPELL_LIST },
    statRecommendationFocus: ['Intelligence', 'Constitution', 'Dexterity'],
    statRecommendationDetails: "Intelligence is paramount for your spellcasting effectiveness. Constitution helps with concentration and hit points. Dexterity can improve your Armor Class, as wizards typically wear no armor.",
    recommendedPointBuyPriorities: ['Intelligence', 'Constitution', 'Dexterity', 'Wisdom', 'Charisma', 'Strength'],
  },
  'artificer': {
    id: 'artificer', name: 'Artificer', description: 'Masters of invention, artificers use ingenuity and magic to unlock extraordinary capabilities in objects.',
    hitDie: 8, primaryAbility: ['Intelligence'], savingThrowProficiencies: ['Constitution', 'Intelligence'],
    skillProficienciesAvailable: ['arcana', 'history', 'investigation', 'medicine', 'nature', 'perception', 'sleight_of_hand'],
    numberOfSkillProficiencies: 2,
    armorProficiencies: ['Light armor', 'Medium armor', 'Shields'], weaponProficiencies: ['Simple weapons'],
    features: [
      { id: 'magical_tinkering', name: 'Magical Tinkering', description: 'You learn how to invest a spark of magic into mundane objects.', levelAvailable: 1 },
      { id: 'artificer_tool_proficiencies', name: "Tool Proficiencies", description: "You gain proficiency with thieves' tools, tinker's tools, and one type of artisan's tools of your choice.", levelAvailable: 1 },
    ],
    spellcasting: {
      ability: 'Intelligence',
      knownCantrips: 2,
      knownSpellsL1: 0, // Artificers select prepared spells, not known spells. This is handled dynamically.
      spellList: ARTIFICER_SPELL_LIST
    },
    statRecommendationFocus: ['Intelligence', 'Constitution', 'Dexterity'],
    statRecommendationDetails: "Intelligence is your spellcasting and infusion ability. Constitution is important for concentration and hit points. Dexterity can improve your Armor Class.",
    recommendedPointBuyPriorities: ['Intelligence', 'Constitution', 'Dexterity', 'Wisdom', 'Strength', 'Charisma'],
  },
};

export const AVAILABLE_CLASSES: SelectableClass[] = Object.values(CLASSES_DATA).map(c => ({
  id: c.id,
  name: c.name,
  description: c.description
}));
