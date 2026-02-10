/**
 * @file lizardfolk.ts
 * Defines the Lizardfolk race.
 */
import { Race } from '../../types';

export const LIZARDFOLK_DATA: Race = {
  id: 'lizardfolk',
  name: 'Lizardfolk',
  baseRace: 'beastfolk',
  description:
    'Lizardfolk are ancient reptilian humanoids adapted to swamps and jungles, valued for their survival instincts and physical resilience.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet, Swim 30 feet',
    'Bite: Your unarmed strike with your bite deals 1d6 + Strength modifier piercing damage.',
    'Hold Breath: You can hold your breath for up to 15 minutes.',
    'Hungry Jaws: As a bonus action, you can make a special bite attack that grants temporary hit points equal to your Constitution modifier on a hit.',
    'Natural Armor: While not wearing armor, your AC is 13 + your Dexterity modifier, and you can use it in place of armor when determining AC.',
  ],
  visual: {
    id: 'lizardfolk',
    color: '#4aa02c',
    maleIllustrationPath: 'assets/images/races/Lizardfolk_Male.png',
    femaleIllustrationPath: 'assets/images/races/Lizardfolk_Female.png',
  },
};
