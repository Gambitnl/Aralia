/**
 * @file kalashtar.ts
 * Represents the kalashtar race.
 */
import { Race } from '../../types';

export const KALASHTAR_DATA: Race = {
  id: 'kalashtar',
  name: 'Kalashtar',
  baseRace: 'kalashtar',
  description:
    'Kalashtar are a compound people, born of human hosts joined with dream spirits, who march toward enlightenment with calm minds and psychic discipline.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Dual Mind: You have advantage on all Wisdom saving throws.',
    'Mental Discipline: You have resistance to psychic damage.',
    'Mind Link: You can speak telepathically to any creature you can see within 10 times your level; you can grant one creature the ability to reply telepathically for 1 hour.',
    'Severed from Dreams: You are immune to effects that require you to dream, but magic that merely sleeps you still works.',
  ],
  visual: {
    id: 'kalashtar',
    icon: '🧘',
    color: '#4b9e95',
    maleIllustrationPath: 'assets/images/races/kalashtar_male.png',
    femaleIllustrationPath: 'assets/images/races/kalashtar_female.png',
  },
};
