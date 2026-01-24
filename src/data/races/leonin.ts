/**
 * @file leonin.ts
 * Defines the leonin race.
 */
import { Race } from '../../types';

export const LEONIN_DATA: Race = {
  id: 'leonin',
  name: 'Leonin',
  baseRace: 'beastfolk',
  description:
    'Leonin are proud, lion-like warriors from the savannas of Theros who live by a code of courage and communal honor.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 35 feet',
    'Darkvision: You can see in dim light within 60 feet and discern colors as shades of gray in darkness.',
    'Claws: Your retractable claws deal 1d6 slashing damage when you hit with an unarmed strike.',
    'Hunter\'s Instincts: You gain proficiency in either Athletics, Intimidation, Perception, or Survival.',
    'Daunting Roar: As a bonus action, you can unleash a roar; creatures of your choice within 10 feet that can hear you must succeed on a Wisdom saving throw or become frightened until the end of your next turn.',
  ],
  visual: {
    id: 'leonin',
    icon: '🦁',
    color: '#995c1f',
    maleIllustrationPath: 'assets/images/Placeholder.jpg',
    femaleIllustrationPath: 'assets/images/Placeholder.jpg',
  },
};
