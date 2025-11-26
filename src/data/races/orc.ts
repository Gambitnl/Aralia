/**
 * @file orc.ts
 * Defines the data for the Orc race in the Aralia RPG, based on Player's Handbook pg. 195.
 * This includes their ID, name, description, and unique traits.
 * Orcs in this version do not have direct ability score bonuses as per the newer PHB style.
 */
import { Race } from '../../types.ts'; // Path relative to src/data/races/

export const ORC_DATA: Race = {
  id: 'orc',
  name: 'Orc',
  description:
    "Orcs trace their creation to Gruumsh, a powerful god who roamed the wide open spaces of the Material Plane. Gruumsh equipped his children with gifts to help them wander great plains, vast caverns, and churning seas and to face the monsters that lurk there. Even when they turn their devotion to other gods, orcs retain Gruumsh’s gifts: endurance, determination, and the ability to see in darkness. Orcs are, on average, tall and broad, with gray skin, sharply pointed ears, and prominent lower canines resembling small tusks.",
  abilityBonuses: [], // As per 2024 PHB style, ASIs are generally not tied directly to race.
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 6–7 feet tall)',
    'Speed: 30 feet',
    'Adrenaline Rush: You can take the Dash action as a Bonus Action. When you do so, you gain a number of Temporary Hit Points equal to your Proficiency Bonus. You can use this trait a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Short or Long Rest. (Note: Mechanical effects like THP gain, usage tracking, and bonus action not yet fully implemented).',
    'Darkvision (120ft)',
    'Relentless Endurance: When you are reduced to 0 Hit Points but not killed outright, you can drop to 1 Hit Point instead. Once you use this trait, you can’t do so again until you finish a Long Rest. (Note: Mechanical implementation not yet in place).',
  ],
};
