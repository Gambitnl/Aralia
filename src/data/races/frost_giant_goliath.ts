/**
 * @file frost_giant_goliath.ts
 * Defines the data for the Frost Giant Goliath race in the Aralia RPG.
 * Frost Giant goliaths can deal cold damage and slow their enemies.
 */
import { Race } from '../../types';

export const FROST_GIANT_GOLIATH_DATA: Race = {
  id: 'frost_giant_goliath',
  name: 'Frost Giant Goliath',
  baseRace: 'goliath',
  description:
    'As a goliath with Frost Giant ancestry, you possess the common traits of your people, enhanced by the freezing power of the mountains that numbs your foes. This cold heritage allows you to sap the heat and momentum from your enemies with every strike. The icy resilience of frost giants courses through you, making your blows as chilling as a winter gale.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 7-8 feet tall)',
    'Speed: 35 feet',
    'Powerful Build: You have advantage on saving throws you make to end the Grappled condition. You also count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift.',
    'Large Form: Starting at 5th level, you can change your size to Large as a Bonus Action. This transformation lasts for 10 minutes or until you end it as a bonus action. While Large, you have advantage on Strength checks, and your speed increases by 10 feet. Once you use this trait, you can\'t use it again until you finish a Long Rest.',
    'Frost\'s Chill: When you hit a target with an attack roll, you can deal an extra 1d6 cold damage and reduce the target\'s speed by 10 feet until the start of your next turn. You can use this trait a number of times equal to your Proficiency Bonus, regaining all uses on a Long Rest.',
  ],
  visual: {
    id: 'frost_giant_goliath',
    icon: '❄️',
    color: '#87CEEB',
    maleIllustrationPath: 'assets/images/races/frost_giant_goliath_male.png',
    femaleIllustrationPath: 'assets/images/races/frost_giant_goliath_female.png',
  },
};
