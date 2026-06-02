/**
 * @file brass_dragonborn.ts
 * Defines the data for the Brass Dragonborn race in the Aralia RPG.
 * Brass dragonborn have fire-based breath weapons and damage resistance.
 */
import { Race } from '../../types';

export const BRASS_DRAGONBORN_DATA: Race = {
  id: 'brass_dragonborn',
  name: 'Brass Dragonborn',
  baseRace: 'draconic_kin',
  description:
    'Descended from brass dragons, these dragonborn carry the legacy of talkative desert dwellers. Their scales gleam in warm metallic hues of bronze and gold, and they wield the power of fire. Brass dragonborn are often sociable and curious, embodying the gregarious nature of their draconic ancestors.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Draconic Ancestry: Brass Dragon - Fire damage',
    'Breath Weapon: When you take the [[attack|Attack]] action, you can replace one of your attacks with an exhalation of [[fire_damage|Fire damage]] in a 15-foot cone or a 30-foot line (your choice). The [[saving_throw|Saving Throw]] DC is 8 + your Constitution modifier + your [[proficiency_bonus|Proficiency Bonus]]. On a failed save, a creature takes 1d10 damage, or half as much on a successful one. The damage increases by 1d10 at levels 5, 11, and 17. You can use this a number of times equal to your Proficiency Bonus per [[long_rest|Long Rest]].',
    'Damage Resistance: You have [[resistance|Resistance]] to [[fire_damage|Fire damage]].',
    'Vision: You have [[darkvision|Darkvision]] with a range of 60 feet.',
    'Draconic Flight (Level 5): Starting at Level 5, you can use a [[bonus_action|Bonus Action]] to sprout spectral wings for 10 minutes or until you\'re [[incapacitated_condition|Incapacitated]]. For the duration, you have a [[fly_speed|Flying Speed]] equal to your walking speed. Once you use this trait, you can\'t do so again until you finish a [[long_rest|Long Rest]].',
    'Draconic Language: You can speak, read, and write Draconic.',
  ],
  visual: {
    id: 'brass_dragonborn',
    color: '#CD853F',
    maleIllustrationPath: 'assets/images/races/Dragonborn_Brass_Male.png',
    femaleIllustrationPath: 'assets/images/races/Dragonborn_Brass_Female.png',
  },
};
