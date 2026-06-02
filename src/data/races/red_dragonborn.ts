/**
 * @file red_dragonborn.ts
 * Defines the data for the Red Dragonborn race in the Aralia RPG.
 * Red dragonborn have fire-based breath weapons and damage resistance.
 */
import { Race } from '../../types';

export const RED_DRAGONBORN_DATA: Race = {
  id: 'red_dragonborn',
  name: 'Red Dragonborn',
  baseRace: 'draconic_kin',
  description:
    'Descended from red dragons, these dragonborn carry the legacy of the most powerful and arrogant chromatic dragons. Their scales blaze in shades of crimson and scarlet, and they command devastating fire. Red dragonborn are often ambitious and fierce, embodying the dominant nature of their draconic ancestors.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Draconic Ancestry: Red Dragon - Fire damage',
    'Breath Weapon: When you take the [[attack|Attack]] action, you can replace one of your attacks with an exhalation of [[fire_damage|Fire damage]] in a 15-foot cone or a 30-foot line (your choice). The [[saving_throw|Saving Throw]] DC is 8 + your Constitution modifier + your [[proficiency_bonus|Proficiency Bonus]]. On a failed save, a creature takes 1d10 damage, or half as much on a successful one. The damage increases by 1d10 at levels 5, 11, and 17. You can use this a number of times equal to your Proficiency Bonus per [[long_rest|Long Rest]].',
    'Damage Resistance: You have [[resistance|Resistance]] to [[fire_damage|Fire damage]].',
    "Vision: You have [[darkvision|Darkvision]] with a range of 60 feet.",
    'Draconic Flight (Level 5): Starting at Level 5, you can use a [[bonus_action|Bonus Action]] to sprout spectral wings for 10 minutes or until you\'re [[incapacitated_condition|Incapacitated]]. For the duration, you have a [[fly_speed|Flying Speed]] equal to your walking speed. Once you use this trait, you can\'t do so again until you finish a [[long_rest|Long Rest]].',
    'Draconic Language: You can speak, read, and write Draconic.',
  ],
  visual: {
    id: 'red_dragonborn',
    color: '#DC143C',
    maleIllustrationPath: 'assets/images/races/Dragonborn_Red_Male.png',
    femaleIllustrationPath: 'assets/images/races/Dragonborn_Red_Female.png',
  },
};
