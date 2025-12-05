/**
 * @file human.ts
 * Defines the data for the Human race in the Aralia RPG, based on Player's Handbook pg. 194.
 * This includes their ID, name, description, and unique traits.
 * Humans in this version do not receive direct ability score bonuses; these are typically
 * handled by background or other choices (like the Versatile trait's Origin Feat).
 */
import { Race } from '../../types.ts'; // Path relative to src/data/races/

export const HUMAN_DATA: Race = {
  id: 'human',
  name: 'Human',
  description:
    'Found throughout the multiverse, humans are as varied as they are numerous, and they endeavor to achieve as much as they can in the years they are given. Their ambition and resourcefulness are commended, respected, and feared on many worlds.',
  // No direct abilityBonuses as per the new design focused on feats/backgrounds for ASIs.
  abilityBonuses: [], // Explicitly empty to override any previous versions with bonuses.
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 4–7 feet tall) or Small (about 2–4 feet tall), chosen when you select this species (defaults to Medium for now).',
    'Speed: 30 feet',
    'Resourceful: You gain Heroic Inspiration whenever you finish a Long Rest (descriptive, not mechanically implemented yet).',
    'Skillful: You gain proficiency in one skill of your choice (chosen during character creation).',
    'Versatile: You gain an Origin feat of your choice.',
  ],
};
