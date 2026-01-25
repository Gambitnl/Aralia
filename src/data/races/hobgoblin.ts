/**
 * @file hobgoblin.ts
 * Defines the Hobgoblin race for the character creator.
 */
import { Race } from '../../types';

export const HOBGOBLIN_DATA: Race = {
  id: 'hobgoblin',
  name: 'Hobgoblin',
  baseRace: 'hobgoblin',
  description:
    'Hobgoblins are disciplined and militant humanoids with a strong sense of hierarchy, trained for organized warfare and ritual obedience.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Fey Ancestry: You have advantage on saving throws to avoid or end the charmed condition.',
    'Fey Gift: You can take the Help action as a bonus action a number of times equal to your Proficiency Bonus per long rest.',
    'Fortune from the Many: When you miss with an attack roll or fail an ability check or saving throw, you can reroll and use the bonus equal to your Proficiency Bonus.',
  ],
  visual: {
    id: 'hobgoblin',
    color: '#a52a2a',
    maleIllustrationPath: 'assets/images/races/hobgoblin_male.png',
    femaleIllustrationPath: 'assets/images/races/hobgoblin_female.png',
  },
};
