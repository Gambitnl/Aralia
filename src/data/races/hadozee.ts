/**
 * @file hadozee.ts
 * Represents the hadozee race documented in the glossary.
 */
import { Race } from '../../types';

export const HADOZEE_DATA: Race = {
  id: 'hadozee',
  name: 'Hadozee',
  baseRace: 'beastfolk',
  description:
    'Hadozee are simian humanoids with membrane-wing flaps that allow them to glide through the air gracefully, adapted from jungle treetops to wildspace.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium or Small',
    'Speed: 30 feet, climb 30 feet',
    'Dexterous Feet: As a bonus action you can use your feet to manipulate objects, open doors, or pick up or set down Tiny objects.',
    'Glide: When you fall at least 10 feet, you can use your reaction to glide horizontally a number of feet equal to five times your proficiency bonus.',
    'Hadozee Resilience: When you take damage, you can use your reaction to roll a d6 and add your proficiency bonus to the roll; you subtract that total from the damage taken.',
  ],
  visual: {
    id: 'hadozee',
    color: '#5a7b9f',
    maleIllustrationPath: 'assets/images/Placeholder.jpg',
    femaleIllustrationPath: 'assets/images/Placeholder.jpg',
  },
};
