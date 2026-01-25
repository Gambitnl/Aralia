/**
 * @file goblin.ts
 * Defines the data for the Goblin race in the Aralia RPG.
 */
import { Race } from '../../types';

export const GOBLIN_DATA: Race = {
  id: 'goblin',
  name: 'Goblin',
  description:
    'A subterranean folk, goblins can be found in every corner of the multiverse, often beside their bugbear and hobgoblin kin. Long before the god Maglubiyet conquered them, early goblins served in the court of the Queen of Air and Darkness, one of the Feywild’s archfey. Goblins thrived in her dangerous domain thanks to a special boon from her—a supernatural knack for finding the weak spots in foes larger than themselves and for getting out of trouble.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid. You are also considered a goblinoid.',
    'Size: Small',
    'Speed: 30 feet',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Fey Ancestry: You have advantage on saving throws you make to avoid or end the charmed condition on yourself.',
    'Fury of the Small: When you damage a creature with an attack or a spell and the creature’s size is larger than yours, you can cause the attack or spell to deal extra damage to the creature. The extra damage equals your proficiency bonus. You can use this trait a number of times equal to your proficiency bonus, regaining all expended uses when you finish a long rest.',
    'Nimble Escape: You can take the Disengage or Hide action as a bonus action on each of your turns.',
  ],
  visual: {
    id: 'goblin',
    color: '#556B2F',
    maleIllustrationPath: 'assets/images/races/Goblin_Male.png',
    femaleIllustrationPath: 'assets/images/races/Goblin_Female.png',
  },
};
