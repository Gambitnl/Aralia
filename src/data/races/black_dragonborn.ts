/**
 * @file black_dragonborn.ts
 * Defines the data for the Black Dragonborn race in the Aralia RPG.
 * Black dragonborn have acid-based breath weapons and damage resistance.
 */
import { Race } from '../../types';

export const BLACK_DRAGONBORN_DATA: Race = {
  id: 'black_dragonborn',
  name: 'Black Dragonborn',
  baseRace: 'draconic_kin',
  description:
    'Descended from black dragons, these dragonborn carry the legacy of swamp-dwelling predators. Their scales range from charcoal to deep obsidian, and they possess an affinity for acid. Black dragonborn are often cunning and patient hunters, embodying the methodical nature of their draconic ancestors.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Draconic Ancestry: Black Dragon - Acid damage',
    'Breath Weapon: When you take the [[attack|Attack]] action, you can replace one of your attacks with an exhalation of [[acid_damage|Acid damage]] in a 15-foot cone or a 30-foot line (your choice). The [[saving_throw|Saving Throw]] DC is 8 + your Constitution modifier + your [[proficiency_bonus|Proficiency Bonus]]. On a failed save, a creature takes 1d10 damage, or half as much on a successful one. The damage increases by 1d10 at levels 5, 11, and 17. You can use this a number of times equal to your Proficiency Bonus per [[long_rest|Long Rest]].',
    'Damage Resistance: You have [[resistance|Resistance]] to [[acid_damage|Acid damage]].',
    "Vision: You have [[darkvision|Darkvision]] with a range of 60 feet.",
    'Draconic Flight (Level 5): Starting at Level 5, you can use a [[bonus_action|Bonus Action]] to sprout spectral wings for 10 minutes or until you\'re [[incapacitated_condition|Incapacitated]]. For the duration, you have a [[fly_speed|Flying Speed]] equal to your walking speed. Once you use this trait, you can\'t do so again until you finish a [[long_rest|Long Rest]].',
    'Draconic Language: You can speak, read, and write Draconic.',
  ],
  visual: {
    id: 'black_dragonborn',
    color: '#2F4F4F',
    maleIllustrationPath: 'assets/images/races/Dragonborn_Black_Male.png',
    femaleIllustrationPath: 'assets/images/races/Dragonborn_Black_Female.png',
  },
  modernizationStatus: 'official_2024',
};
