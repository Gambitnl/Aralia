/**
 * @file harengon.ts
 * Represents the Harengon fey race.
 */
import { Race } from '../../types';

export const HARENGON_DATA: Race = {
  id: 'harengon',
  name: 'Harengon',
  baseRace: 'beastfolk',
  description:
    'Harengon are rabbit-folk refugees from the Feywild, known for their luck, quick reflexes, and boundless energy.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium or Small',
    'Speed: 30 feet',
    'Hare-Trigger: You can add your Proficiency Bonus to your initiative rolls.',
    'Leporine Senses: You have proficiency in the Perception skill.',
    'Lucky Footwork: When you fail a Dexterity saving throw, you can use your reaction to roll a d4 and add it to the save.',
    'Rabbit Hop: As a bonus action, you can jump a number of feet equal to five times your Proficiency Bonus without provoking opportunity attacks.',
  ],
  visual: {
    id: 'harengon',
    color: '#b98b60',
    maleIllustrationPath: 'assets/images/races/Harengon_Male.png',
    femaleIllustrationPath: 'assets/images/races/Harengon_Female.png',
  },
};
