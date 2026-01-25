/**
 * @file minotaur.ts
 * Defines the Minotaur race.
 */
import { Race } from '../../types';

export const MINOTAUR_DATA: Race = {
  id: 'minotaur',
  name: 'Minotaur',
  baseRace: 'beastfolk',
  description:
    'Minotaurs are powerful bull-headed humanoids whose strength and ferocity make them relentless warriors in labyrinthine ruins and arenas.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Horns: Your horns deal 1d6 + Strength modifier piercing damage when you hit with an unarmed strike.',
    'Goring Rush: When you take the Dash action and move at least 20 feet, you can make one melee attack with your horns as part of the Attack action.',
    'Hammering Horns: After hitting with a melee attack, you can use a bonus action to make another horn attack.',
  ],
  visual: {
    id: 'minotaur',
    color: '#9b4b2f',
    maleIllustrationPath: 'assets/images/Placeholder.jpg',
    femaleIllustrationPath: 'assets/images/Placeholder.jpg',
  },
};
