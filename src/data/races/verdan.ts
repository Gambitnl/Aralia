/**
 * @file verdan.ts
 * Defines the data for the Verdan race in the Aralia RPG, the ever-changing people born from Granny Nightshade's chaos.
 */
import { Race } from '../../types';

export const VERDAN_DATA: Race = {
  id: 'verdan',
  name: 'Verdan',
  description:
    'Verdan are former goblins and hobgoblins who were transformed by chaotic magic and now continually evolve as they grow. Driven by curiosity, empathy, and a desire to carve out a kinder place in the world, they embrace change and the communities they build.',
  abilityBonuses: [
    { ability: 'Constitution', bonus: 2 },
    { ability: 'Charisma', bonus: 1 },
  ],
  traits: [
    'Creature Type: Humanoid',
    'Size: Small (they grow toward Medium as they age)',
    'Speed: 30 feet',
    'Black Blood Healing: When you roll a 1 or 2 on a Hit Die at the end of a Short Rest, you can reroll the die and must use the new roll.',
    'Limited Telepathy: You can telepathically speak to any creature you can see within 30 feet of you. The creature must understand at least one language or be telepathic, but it does not gain the ability to respond telepathically.',
    'Persuasive: You gain proficiency in the Persuasion skill.',
    'Telepathic Insight: You have advantage on Wisdom and Charisma saving throws.',
  ],
  visual: {
    id: 'verdan',
    color: '#2b8c45',
    maleIllustrationPath: 'assets/images/races/verdan_male.png',
    femaleIllustrationPath: 'assets/images/races/verdan_female.png',
  },
};
