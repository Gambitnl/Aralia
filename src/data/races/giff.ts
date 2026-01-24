/**
 * @file giff.ts
 * Represents the giff from Spelljammer.
 */
import { Race } from '../../types';

export const GIFF_DATA: Race = {
  id: 'giff',
  name: 'Giff',
  baseRace: 'beastfolk',
  description:
    'Giff are hippo-headed humanoids renowned for their martial prowess, booming laughter, and love of heavy firearms spread across the multiverse.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet, swim 30 feet',
    'Astral Spark: When you make an attack roll, saving throw, or ability check, you can add your Proficiency Bonus after you see the d20 roll; you can do so a number of times equal to your Proficiency Bonus per long rest.',
    'Firearms Mastery: You are proficient with all firearms, ignore the loading property, and firing at long range does not impose disadvantage when using firearms.',
    'Hippo Build: You have advantage on Strength checks and saving throws, and you count as one size larger for your carrying capacity and push/drag/lift limits.',
  ],
  visual: {
    id: 'giff',
    icon: '🔫',
    color: '#c95f4f',
    maleIllustrationPath: 'assets/images/races/giff_male.png',
    femaleIllustrationPath: 'assets/images/races/giff_female.png',
  },
};
