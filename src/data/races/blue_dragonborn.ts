/**
 * @file blue_dragonborn.ts
 * Defines the data for the Blue Dragonborn race in the Aralia RPG.
 * Blue dragonborn have lightning-based breath weapons and damage resistance.
 */
import { Race } from '../../types';

export const BLUE_DRAGONBORN_DATA: Race = {
  id: 'blue_dragonborn',
  name: 'Blue Dragonborn',
  baseRace: 'draconic_kin',
  description:
    'Descended from blue dragons, these dragonborn carry the legacy of desert storm lords. Their scales shimmer in shades of sapphire and cobalt, and they command the power of lightning. Blue dragonborn are often proud and territorial, reflecting the commanding presence of their draconic ancestors.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Draconic Ancestry: Blue Dragon - Lightning damage',
    'Breath Weapon: When you take the [[attack|Attack]] action, you can replace one of your attacks with an exhalation of [[lightning_damage|Lightning damage]] in a 15-foot cone or a 30-foot line (your choice). The [[saving_throw|Saving Throw]] DC is 8 + your Constitution modifier + your [[proficiency_bonus|Proficiency Bonus]]. On a failed save, a creature takes 1d10 damage, or half as much on a successful one. The damage increases by 1d10 at levels 5, 11, and 17. You can use this a number of times equal to your Proficiency Bonus per [[long_rest|Long Rest]].',
    'Damage Resistance: You have [[resistance|Resistance]] to [[lightning_damage|Lightning damage]].',
    'Vision: You have [[darkvision|Darkvision]] with a range of 60 feet.',
    'Draconic Flight (Level 5): Starting at Level 5, you can use a [[bonus_action|Bonus Action]] to sprout spectral wings for 10 minutes or until you\'re [[incapacitated_condition|Incapacitated]]. For the duration, you have a [[fly_speed|Flying Speed]] equal to your walking speed. Once you use this trait, you can\'t do so again until you finish a [[long_rest|Long Rest]].',
    'Draconic Language: You can speak, read, and write Draconic.',
  ],
  visual: {
    id: 'blue_dragonborn',
    color: '#4169E1',
    maleIllustrationPath: 'assets/images/races/Dragonborn_Blue_Male.png',
    femaleIllustrationPath: 'assets/images/races/Dragonborn_Blue_Female.png',
  },
};
