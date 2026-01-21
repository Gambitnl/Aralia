/**
 * @file stone_giant_goliath.ts
 * Defines the data for the Stone Giant Goliath race in the Aralia RPG.
 * Stone Giant goliaths can reduce incoming damage with their stone-like endurance.
 */
import { Race } from '../../types';

export const STONE_GIANT_GOLIATH_DATA: Race = {
  id: 'stone_giant_goliath',
  name: 'Stone Giant Goliath',
  baseRace: 'goliath',
  description:
    'As a goliath with Stone Giant ancestry, you possess the common traits of your people, enhanced by the endurance of the mountains. This heritage allows you to shrug off blows that would fell others, as your skin momentarily takes on the unyielding resilience of ancient stone. The steadfast durability of stone giants flows through you, making you nearly unmovable when you choose to stand your ground.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 7-8 feet tall)',
    'Speed: 35 feet',
    'Powerful Build: You have advantage on saving throws you make to end the Grappled condition. You also count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift.',
    'Large Form: Starting at 5th level, you can change your size to Large as a Bonus Action. This transformation lasts for 10 minutes or until you end it as a bonus action. While Large, you have advantage on Strength checks, and your speed increases by 10 feet. Once you use this trait, you can\'t use it again until you finish a Long Rest.',
    'Stone\'s Endurance: When you take damage, you can use your Reaction to roll a d12. Add your Constitution modifier to the number rolled and reduce the damage by that total. You can use this trait a number of times equal to your Proficiency Bonus, regaining all uses on a Long Rest.',
  ],
  visual: {
    id: 'stone_giant_goliath',
    icon: '🗿',
    color: '#808080',
    maleIllustrationPath: 'assets/images/races/Goliath_Stone Giant_Male.png',
    femaleIllustrationPath: 'assets/images/races/Goliath_Stone Giant_Female.png',
  },
};
