/**
 * @file green_dragonborn.ts
 * Defines the data for the Green Dragonborn race in the Aralia RPG.
 * Green dragonborn have poison-based breath weapons and damage resistance.
 */
import { Race } from '../../types';

export const GREEN_DRAGONBORN_DATA: Race = {
  id: 'green_dragonborn',
  name: 'Green Dragonborn',
  baseRace: 'draconic_kin',
  description:
    'Descended from green dragons, these dragonborn carry the legacy of forest manipulators and schemers. Their scales range from emerald to forest green, and they possess an affinity for poison. Green dragonborn are often cunning and persuasive, embodying the devious nature of their draconic ancestors.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Draconic Ancestry: Green Dragon - Poison damage',
    'Breath Weapon: When you take the [[attack|Attack]] action, you can replace one of your attacks with an exhalation of [[poison_damage|Poison damage]] in a 15-foot cone or a 30-foot line (your choice). The [[saving_throw|Saving Throw]] DC is 8 + your Constitution modifier + your [[proficiency_bonus|Proficiency Bonus]]. On a failed save, a creature takes 1d10 damage, or half as much on a successful one. The damage increases by 1d10 at levels 5, 11, and 17. You can use this a number of times equal to your Proficiency Bonus per [[long_rest|Long Rest]].',
    'Damage Resistance: You have [[resistance|Resistance]] to [[poison_damage|Poison damage]].',
    'Vision: You have [[darkvision|Darkvision]] with a range of 60 feet.',
    'Draconic Flight (Level 5): Starting at Level 5, you can use a [[bonus_action|Bonus Action]] to sprout spectral wings for 10 minutes or until you\'re [[incapacitated_condition|Incapacitated]]. For the duration, you have a [[fly_speed|Flying Speed]] equal to your walking speed. Once you use this trait, you can\'t do so again until you finish a [[long_rest|Long Rest]].',
    'Draconic Language: You can speak, read, and write Draconic.',
  ],
  visual: {
    id: 'green_dragonborn',
    color: '#228B22',
    maleIllustrationPath: 'assets/images/races/Dragonborn_Green_Male.png',
    femaleIllustrationPath: 'assets/images/races/Dragonborn_Green_Female.png',
  },
};
