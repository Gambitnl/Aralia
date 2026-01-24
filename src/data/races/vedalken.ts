/**
 * @file vedalken.ts
 * Defines the data for the Vedalken race in the Aralia RPG, inspired by their perfectionist Ravnica roots.
 */
import { Race } from '../../types';

export const VEDALKEN_DATA: Race = {
  id: 'vedalken',
  name: 'Vedalken',
  description:
    'Vedalken are blue-skinned, calm thinkers from the plane of Ravnica who strive for constant improvement in everything they touch. They prize logic, precision, and intellect, and their communities are built around self-discipline and collective advancement.',
  abilityBonuses: [
    { ability: 'Intelligence', bonus: 2 },
    { ability: 'Wisdom', bonus: 1 },
  ],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (around 5 to 6 feet tall)',
    'Speed: 30 feet',
    'Vedalken Dispassion: You have advantage on saving throws to avoid or end the charmed condition, and magic can’t put you to sleep.',
    'Tireless Precision: Once per short rest, you can reroll an Intelligence or Wisdom ability check and must use the new roll.',
    'Partially Amphibious: You can hold your breath for 10 minutes and can breathe both air and water.',
    'Intellect: You gain proficiency in Investigation and double your proficiency bonus on Intelligence (Investigation) checks that allow proficiency.',
  ],
  visual: {
    id: 'vedalken',
    icon: '🧠',
    color: '#3c5a82',
    maleIllustrationPath: 'assets/images/races/vedalken_male.png',
    femaleIllustrationPath: 'assets/images/races/vedalken_female.png',
  },
};
