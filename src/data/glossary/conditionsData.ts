/**
 * @file src/data/glossary/conditionsData.ts
 *
 * This file contains the complete structured dataset of PHB 2024 conditions
 * and exhaustion rules.
 *
 * Why it exists:
 * In D&D 5e (2024 revision), conditions are the primary status ailments and tactical
 * states that affect combatants. Having them represented as clean, structured data
 * allows the Compendium to render sortable overview tables, interactive chips, and
 * quick-glance tactical summaries (such as attack advantage/disadvantage, speed modifiers,
 * and saving throw penalties).
 *
 * Connects to:
 * - src/data/glossary/types.ts for ConditionRuleEntry and ExhaustionTier
 * - src/components/Compendium/ConditionTable.tsx for table rendering
 * - src/data/glossary/searchIndex.ts for cross-table searching
 */

import { ConditionRuleEntry } from './types';

// ============================================================================
// Conditions Dataset
// ============================================================================
// The canonical PHB 2024 conditions, including all 14 standard conditions and
// the 6-level Exhaustion mechanic.
// ============================================================================

export const CONDITIONS_DATA: ConditionRuleEntry[] = [
  {
    id: 'blinded',
    name: 'Blinded',
    summary: "You can't see and automatically fail ability checks requiring sight; attacks against you have Advantage, and your attacks have Disadvantage.",
    effects: [
      "Can't See: You can't see and automatically fail any ability check that requires sight.",
      "Attacks Affected: Attack rolls against you have Advantage, and your attack rolls have Disadvantage.",
    ],
    attackModifications: {
      attacksAgainstHaveAdvantage: true,
      attacksMadeHaveDisadvantage: true,
      details: 'Attack rolls against you have Advantage; your attack rolls have Disadvantage.',
    },
    savingThrowEffects: 'Auto-fails ability checks that require sight.',
    seeAlso: ['unseen_attackers_and_targets', 'vision_and_light', 'advantage', 'disadvantage'],
    phb2024Notes: 'Streamlined wording; reinforces automatic failure on vision-based ability checks.',
  },
  {
    id: 'charmed',
    name: 'Charmed',
    summary: "You can't attack or target the charmer with harmful abilities or magical effects, and the charmer has Advantage on social ability checks against you.",
    effects: [
      "Can't Harm Charmer: You can't attack the charmer or target the charmer with harmful abilities or magical effects.",
      'Social Advantage: The charmer has Advantage on any ability check to interact socially with you.',
    ],
    attackModifications: {
      details: "Cannot make attacks targeting the charmer.",
    },
    seeAlso: ['advantage', 'influence_action', 'friendly_attitude'],
    phb2024Notes: 'Explicitly bars harmful magical effects as well as direct attacks.',
  },
  {
    id: 'deafened',
    name: 'Deafened',
    summary: "You can't hear and automatically fail any ability check that requires hearing.",
    effects: [
      "Can't Hear: You can't hear and automatically fail any ability check that requires hearing.",
    ],
    savingThrowEffects: 'Auto-fails ability checks that require hearing.',
    seeAlso: ['auditory_perception', 'verbal_component'],
    phb2024Notes: 'Clearer interaction with verbal spell components and audible warnings.',
  },
  {
    id: 'frightened',
    name: 'Frightened',
    summary: "Disadvantage on ability checks and attack rolls while the source of fear is in line of sight; you can't willingly move closer to the source.",
    effects: [
      'Ability & Attack Penalty: You have Disadvantage on ability checks and attack rolls while the source of your fear is within line of sight.',
      "Movement Restricted: You can't willingly move to a space that is closer to the source of your fear than your starting space.",
    ],
    attackModifications: {
      attacksMadeHaveDisadvantage: true,
      details: 'Disadvantage on attack rolls while source of fear is within line of sight.',
    },
    movementRestrictions: "Cannot willingly move closer to the source of fear.",
    seeAlso: ['disadvantage', 'line_of_sight', 'speed'],
    phb2024Notes: 'Maintains tactical lockdown by prohibiting inward movement towards the source.',
  },
  {
    id: 'grappled',
    name: 'Grappled',
    summary: "Your Speed is 0; attacks against you have Advantage from the grappler; you can attempt an Athletics/Acrobatics save at the end of each turn.",
    effects: [
      'Speed 0: Your Speed is 0 and cannot increase until the grapple ends.',
      'Attacks Affected: You have Disadvantage on attack rolls against any target other than the grappler.',
      'Movable: The grappler can drag or carry you when it moves, but its Speed is halved unless you are Tiny or two sizes smaller than the grappler.',
      'Escape DC: At the end of each of your turns, you can make a Strength or Dexterity saving throw against the grapple escape DC (8 + Str mod + Prof).',
    ],
    attackModifications: {
      attacksMadeHaveDisadvantage: true,
      details: 'Disadvantage on attack rolls against targets other than the grappler.',
    },
    movementRestrictions: 'Speed is 0 and cannot increase.',
    savingThrowEffects: 'Str or Dex save vs escape DC at the end of each turn.',
    seeAlso: ['unarmed_strike', 'shove', 'speed', 'restrained'],
    phb2024Notes: '2024 Revision: Grappling now uses Saving Throws (DC 8 + Str mod + Prof) rather than contested ability checks, speeding up resolution at the table.',
  },
  {
    id: 'incapacitated',
    name: 'Incapacitated',
    summary: "You can't take Actions, Bonus Actions, or Reactions; Concentration is broken; you can't speak; Disadvantage on Initiative rolls.",
    effects: [
      "No Actions: You can't take Actions, Bonus Actions, or Reactions.",
      'Concentration Broken: Your Concentration is instantly broken.',
      "Speechless: You can't speak.",
      'Surprise & Initiative: If you are Incapacitated when you roll Initiative, you have Disadvantage on the roll.',
    ],
    attackModifications: {
      details: 'Cannot make attacks because you cannot take Actions or Reactions.',
    },
    spellcastingEffects: 'Instantly breaks Concentration; cannot cast spells requiring Actions/Reactions.',
    seeAlso: ['action_economy', 'concentration', 'initiative', 'paralyzed', 'stunned', 'unconscious'],
    phb2024Notes: 'Now explicitly imposes Disadvantage on Initiative if incapacitated when combat begins.',
  },
  {
    id: 'invisible',
    name: 'Invisible',
    summary: "Concealed from ordinary sight; Advantage on attack rolls; attacks against you have Disadvantage; you don't provoke Opportunity Attacks.",
    effects: [
      'Surprise & Stealth: You are considered heavily obscured for the purpose of hiding. You can still be detected by noises or tracks.',
      'Attacks Affected: Attack rolls against you have Disadvantage, and your attack rolls have Advantage.',
      'No Opportunity Attacks: Your movement does not provoke Opportunity Attacks from creatures that cannot see you.',
    ],
    attackModifications: {
      attacksAgainstHaveAdvantage: false,
      attacksMadeHaveDisadvantage: false,
      details: 'You have Advantage on attack rolls; attacks against you have Disadvantage.',
    },
    seeAlso: ['heavily_obscured', 'hide_action', 'blindsight', 'truesight', 'opportunity_attack'],
    phb2024Notes: 'Explicitly grants immunity to Opportunity Attacks from foes who cannot see through the invisibility.',
  },
  {
    id: 'paralyzed',
    name: 'Paralyzed',
    summary: "You are Incapacitated and can't move or speak; auto-fail Str & Dex saves; attacks against have Advantage, and hits within 5 ft are critical hits.",
    effects: [
      'Incapacitated: You are Incapacitated (cannot take Actions, Bonus Actions, or Reactions; Concentration breaks).',
      "Immobilized: You can't move or speak.",
      'Saving Throws: You automatically fail Strength and Dexterity saving throws.',
      'Attacks Affected: Attack rolls against you have Advantage.',
      'Automatic Critical Hits: Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you.',
    ],
    attackModifications: {
      attacksAgainstHaveAdvantage: true,
      autoCriticalWithin5Feet: true,
      details: 'Attacks against you have Advantage. Any hit from within 5 feet is an automatic Critical Hit.',
    },
    movementRestrictions: "Cannot move (Speed is 0).",
    savingThrowEffects: 'Automatically fails all Strength and Dexterity saving throws.',
    spellcastingEffects: 'Concentration broken; cannot cast spells.',
    seeAlso: ['incapacitated', 'critical_hit', 'saving_throw', 'unconscious'],
    phb2024Notes: 'Devastating lockdown state that guarantees melee critical strikes.',
  },
  {
    id: 'petrified',
    name: 'Petrified',
    summary: "Transformed into solid inanimate substance (stone); Incapacitated; weight x10; Resistance to all damage; immune to Poison and Disease.",
    effects: [
      'Solid Transformation: You and all nonmagical objects you carry are transformed into an inanimate solid substance (usually stone). Your weight increases tenfold, and you cease aging.',
      'Incapacitated: You are Incapacitated, cannot move or speak, and are unaware of your surroundings.',
      'Saving Throws: You automatically fail Strength and Dexterity saving throws.',
      'Attacks Affected: Attack rolls against you have Advantage.',
      'Resistances & Immunities: You have Resistance to all damage and Immunity to Poison and Disease (existing poison/disease is suspended).',
    ],
    attackModifications: {
      attacksAgainstHaveAdvantage: true,
      details: 'Attacks against you have Advantage.',
    },
    movementRestrictions: 'Cannot move or take physical actions.',
    savingThrowEffects: 'Automatically fails Strength and Dexterity saving throws.',
    spellcastingEffects: 'Concentration broken; completely unaware of surroundings.',
    seeAlso: ['incapacitated', 'damage_types', 'immunity', 'resistance'],
    phb2024Notes: 'Confers 10x weight multiplier and universal damage resistance.',
  },
  {
    id: 'poisoned',
    name: 'Poisoned',
    summary: "You have Disadvantage on attack rolls and ability checks.",
    effects: [
      'Impaired Function: You have Disadvantage on attack rolls and ability checks.',
    ],
    attackModifications: {
      attacksMadeHaveDisadvantage: true,
      details: 'Disadvantage on all attack rolls.',
    },
    savingThrowEffects: 'Disadvantage on ability checks (including grapple/initiative/skill checks).',
    seeAlso: ['damage_types', 'disadvantage', 'ability_check'],
    phb2024Notes: 'Consistent baseline debuff for biological toxicity.',
  },
  {
    id: 'prone',
    name: 'Prone',
    summary: "You are lying down; crawling is your only movement; attacks made have Disadvantage; melee attacks within 5 ft have Advantage; ranged attacks have Disadvantage.",
    effects: [
      'Movement: Your only movement option is to crawl (each foot of movement costs 1 extra foot), unless you stand up by spending half your Speed.',
      'Attacks Made: You have Disadvantage on attack rolls.',
      'Attacks Against: An attack roll against you has Advantage if the attacker is within 5 feet of you. Otherwise, the attack roll has Disadvantage.',
    ],
    attackModifications: {
      attacksAgainstHaveAdvantage: true,
      attacksMadeHaveDisadvantage: true,
      details: 'Disadvantage on your attack rolls. Advantage on attacks against you from within 5 ft; Disadvantage from farther than 5 ft.',
    },
    movementRestrictions: 'Crawling costs 2 ft per 1 ft traveled. Standing costs half your total Speed.',
    seeAlso: ['crawling', 'speed', 'topple', 'shove'],
    phb2024Notes: 'Synergizes with the new Weapon Mastery "Topple" property and Unarmed Strike Shove options.',
  },
  {
    id: 'restrained',
    name: 'Restrained',
    summary: "Your Speed is 0; attacks against you have Advantage, and your attacks have Disadvantage; Disadvantage on Dexterity saving throws.",
    effects: [
      'Speed 0: Your Speed is 0 and cannot increase.',
      'Attacks Affected: Attack rolls against you have Advantage, and your attack rolls have Disadvantage.',
      'Dexterity Saves: You have Disadvantage on Dexterity saving throws.',
    ],
    attackModifications: {
      attacksAgainstHaveAdvantage: true,
      attacksMadeHaveDisadvantage: true,
      details: 'Attacks against you have Advantage; your attacks have Disadvantage.',
    },
    movementRestrictions: 'Speed is 0 and cannot increase.',
    savingThrowEffects: 'Disadvantage on Dexterity saving throws.',
    seeAlso: ['grappled', 'paralyzed', 'saving_throw', 'speed'],
    phb2024Notes: 'Commonly applied by nets, webs, and constriction mechanics.',
  },
  {
    id: 'stunned',
    name: 'Stunned',
    summary: "You are Incapacitated and can't move; speak only falteringly; auto-fail Str & Dex saves; attacks against you have Advantage.",
    effects: [
      'Incapacitated: You are Incapacitated (cannot take Actions, Bonus Actions, or Reactions; Concentration breaks).',
      "Immobilized: You can't move. You can speak only falteringly.",
      'Saving Throws: You automatically fail Strength and Dexterity saving throws.',
      'Attacks Affected: Attack rolls against you have Advantage.',
    ],
    attackModifications: {
      attacksAgainstHaveAdvantage: true,
      details: 'Attack rolls against you have Advantage.',
    },
    movementRestrictions: 'Cannot move (Speed is 0).',
    savingThrowEffects: 'Automatically fails Strength and Dexterity saving throws.',
    spellcastingEffects: 'Concentration broken; cannot cast spells.',
    seeAlso: ['incapacitated', 'paralyzed', 'monk_stunning_strike'],
    phb2024Notes: 'Key mechanic for Monk class features and high-concussion spells.',
  },
  {
    id: 'unconscious',
    name: 'Unconscious',
    summary: "Incapacitated and Prone; drop held items; unaware of surroundings; auto-fail Str & Dex saves; attacks have Advantage; hits within 5 ft are critical hits.",
    effects: [
      'Incapacitated & Prone: You are Incapacitated and fall Prone. You drop whatever you are holding.',
      'Unaware: You are unaware of your surroundings.',
      'Saving Throws: You automatically fail Strength and Dexterity saving throws.',
      'Attacks Affected: Attack rolls against you have Advantage.',
      'Automatic Critical Hits: Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you.',
    ],
    attackModifications: {
      attacksAgainstHaveAdvantage: true,
      autoCriticalWithin5Feet: true,
      details: 'Attacks against you have Advantage. Any hit from within 5 feet is an automatic Critical Hit.',
    },
    movementRestrictions: 'Cannot move or stand.',
    savingThrowEffects: 'Automatically fails Strength and Dexterity saving throws.',
    spellcastingEffects: 'Concentration broken; dropped out of spellcasting.',
    seeAlso: ['incapacitated', 'prone', 'critical_hit', 'death_saving_throw'],
    phb2024Notes: 'Applied immediately when dropped to 0 Hit Points unless stabilized or dead.',
  },
  {
    id: 'exhaustion',
    name: 'Exhaustion',
    summary: 'Cumulative 6-level condition: each level inflicts -2 to D20 Tests and -5 ft Speed; Level 6 causes death. Long Rest removes 1 level.',
    effects: [
      'Cumulative Tiers: Exhaustion is measured in six discrete levels. Each time you gain Exhaustion, you increase your level by 1.',
      'D20 Penalty: When you make a D20 Test, your roll is reduced by 2 times your Exhaustion level (up to -10 at Level 5).',
      'Speed Reduction: Your Speed is reduced by 5 feet times your Exhaustion level (up to -25 ft at Level 5).',
      'Fatal Threshold: If your Exhaustion level reaches 6, you immediately die.',
      'Recovery: Finishing a Long Rest removes 1 level of Exhaustion, provided you have consumed adequate food and water.',
    ],
    exhaustionTiers: [
      { level: 1, d20Penalty: -2, speedReductionFeet: 5, specialEffect: 'Minor fatigue; -2 to d20 tests, -5 ft speed.' },
      { level: 2, d20Penalty: -4, speedReductionFeet: 10, specialEffect: 'Moderate fatigue; -4 to d20 tests, -10 ft speed.' },
      { level: 3, d20Penalty: -6, speedReductionFeet: 15, specialEffect: 'Severe fatigue; -6 to d20 tests, -15 ft speed.' },
      { level: 4, d20Penalty: -8, speedReductionFeet: 20, specialEffect: 'Extreme fatigue; -8 to d20 tests, -20 ft speed.' },
      { level: 5, d20Penalty: -10, speedReductionFeet: 25, specialEffect: 'Near collapse; -10 to d20 tests, -25 ft speed.' },
      { level: 6, d20Penalty: -12, speedReductionFeet: 30, specialEffect: 'FATAL: You immediately die.' },
    ],
    movementRestrictions: 'Speed reduced by 5 ft per Exhaustion level.',
    savingThrowEffects: 'D20 penalty (-2x level) applies to all Saving Throws as well as Ability Checks and Attacks.',
    seeAlso: ['d20_test', 'speed', 'long_rest', 'death'],
    phb2024Notes: '2024 Revision: Completely replaces the confusing disparate 2014 penalties (half speed, disadvantage, hp max halved) with a clean linear formula: -2 per level on d20 tests, -5 ft per level on speed.',
  },
];
