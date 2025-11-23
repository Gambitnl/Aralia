/**
 * @file halfling.ts
 * Defines the data for the Halfling race in the Aralia RPG, based on Player's Handbook pg. 193.
 * This includes their ID, name, description, and unique traits.
 * Halflings in this version do not have subraces or direct ability score bonuses as per the newer PHB style.
 */
import { Race } from '../../types'; // Path relative to src/data/races/

export const HALFLING_DATA: Race = {
  id: 'halfling',
  name: 'Halfling',
  description:
    'Cherished and guided by gods who value life, home, and hearth, halflings gravitate toward bucolic havens where family and community help shape their lives. Many halflings possess a brave and adventurous spirit that leads them on journeys of discovery. Their size helps them pass through crowds unnoticed and slip through tight spaces. The "luck of the halflings" often seems to intervene on their behalf in mortal danger. Halfling communities vary widely, from sequestered shires to urban syndicates.',
  abilityBonuses: [], // As per 2024 PHB style, ASIs are generally not tied directly to race.
  traits: [
    'Creature Type: Humanoid',
    'Size: Small (about 2–3 feet tall)',
    'Speed: 30 feet',
    'Brave: You have Advantage on saving throws you make to avoid or end the Frightened condition.',
    'Halfling Nimbleness: You can move through the space of any creature that is a size larger than you, but you can’t stop in the same space.',
    'Luck: When you roll a 1 on the d20 of a D20 Test, you can reroll the die, and you must use the new roll. (Note: Mechanical implementation of reroll not yet in place).',
    'Naturally Stealthy: You can take the Hide action even when you are obscured only by a creature that is at least one size larger than you. (Note: Specific conditions for Hide action not yet fully mechanically enforced).',
  ],
  imageUrl: 'https://i.ibb.co/whZmW9dC/Halfling.png',
};
