/**
 * @file orc.ts
 * Defines the data for the Orc race in the Aralia RPG, based on Player's Handbook pg. 195.
 * This includes their ID, name, description, and unique traits.
 * Orcs in this version do not have direct ability score bonuses as per the newer PHB style.
 */
import { Race } from '../../types'; // Path relative to src/data/races/

export const ORC_DATA: Race = {
  id: 'orc',
  name: 'Orc',
  baseRace: 'greenskins',
  description:
    "Orcs trace their creation to Gruumsh, a powerful god who roamed the wide open spaces of the Material Plane. Gruumsh equipped his children with gifts to help them wander great plains, vast caverns, and churning seas and to face the monsters that lurk there. Even when they turn their devotion to other gods, orcs retain Gruumsh's gifts: endurance, determination, and the ability to see in darkness. Orcs are, on average, tall and broad, with gray skin, sharply pointed ears, and prominent lower canines resembling small tusks.",
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 6-7 feet tall)',
    'Speed: 30 feet',
    'Adrenaline Rush: You can take the [[dash|Dash]] action as a [[bonus_action|Bonus Action]]. When you do so, you gain a number of [[temporary_hit_points|Temporary Hit Points]] equal to your [[proficiency_bonus|Proficiency Bonus]]. You can use this trait a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a [[long_rest|Long Rest]].',
    'Darkvision: You have [[darkvision|Darkvision]] with a range of 120 feet.',
    'Powerful Build: You have [[advantage]] on saving throws you make to end the [[grappled_condition|Grappled]] condition. You also count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift.',
    "Relentless Endurance: When you are reduced to 0 [[hit_points|Hit Points]] but not killed outright, you can drop to 1 Hit Point instead. Once you use this trait, you can't do so again until you finish a [[long_rest|Long Rest]].",
  ],
  visual: {
    id: 'orc',
    color: '#556B2F',
    maleIllustrationPath: 'assets/images/races/Orc_Male.png',
    femaleIllustrationPath: 'assets/images/races/Orc_Female.png',
  },
};
