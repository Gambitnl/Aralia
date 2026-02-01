/**
 * @file kender.ts
 * Defines the curious Kender folk.
 */
import { Race } from '../../types';

export const KENDER_DATA: Race = {
  id: 'kender',
  name: 'Kender',
  baseRace: 'planar_travelers',
  description:
    'Kender are fearless smallfolk from Krynn, defined by their infectious curiosity, knack for finding things, and carefree approach to danger.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Small',
    'Speed: 30 feet',
    'Fearless: You have advantage on saving throws to avoid or end the frightened condition, and you can reroll failed saves once per rest.',
    'Kender Curiosity: You gain proficiency in one skill of your choice from Insight, Investigation, or Sleight of Hand.',
    'Taunt: As a bonus action, you can unleash a provocative string of words at a creature within 60 feet that can hear you, forcing it to use its reaction to attack you if it can.',
  ],
  visual: {
    id: 'kender',
    color: '#c38d13',
    maleIllustrationPath: 'assets/images/races/kender_male.png',
    femaleIllustrationPath: 'assets/images/races/kender_female.png',
  },
};
