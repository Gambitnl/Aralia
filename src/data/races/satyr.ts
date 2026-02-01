/**
 * @file satyr.ts
 * Represents the Satyr race.
 */
import { Race } from '../../types';

export const SATYR_DATA: Race = {
  id: 'satyr',
  name: 'Satyr',
  baseRace: 'feyfolk',
  description:
    'Satyrs are fey revelers whose goat-like lower halves and innate magic make them natural performers and tricksters.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Fey',
    'Size: Medium',
    'Speed: 35 feet',
    'Ram: You can make unarmed strikes with your horns dealing 1d6 + Strength modifier bludgeoning damage.',
    'Magic Resistance: You have advantage on saving throws against spells.',
    'Mirthful Leaps: When you make a long or high jump, you can roll a d8 and add it to the distance.',
    'Reveler: You are proficient in Performance and Persuasion.',
  ],
  visual: {
    id: 'satyr',
    color: '#7c6c2b',
    maleIllustrationPath: 'assets/images/races/satyr_male.png',
    femaleIllustrationPath: 'assets/images/races/satyr_female.png',
  },
};
