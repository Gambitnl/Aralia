/**
 * @file storm_giant_goliath.ts
 * Defines the data for the Storm Giant Goliath race in the Aralia RPG.
 * Storm Giant goliaths can strike back with thunder damage when hit.
 */
import { Race } from '../../types';

export const STORM_GIANT_GOLIATH_DATA: Race = {
  id: 'storm_giant_goliath',
  name: 'Storm Giant Goliath',
  baseRace: 'goliath',
  description:
    'As a goliath with Storm Giant ancestry, you possess the common traits of your people, enhanced by the crackling power of the tempest. This heritage allows you to strike back at those who dare harm you, manifesting your ancestral fury as a localized crackle of thunder and lightning. The majestic wrath of storm giants surges within you, punishing those who would challenge your might.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 7-8 feet tall)',
    'Speed: 35 feet',
    'Powerful Build: You have advantage on saving throws you make to end the Grappled condition. You also count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift.',
    'Large Form: Starting at 5th level, you can change your size to Large as a Bonus Action. This transformation lasts for 10 minutes or until you end it as a bonus action. While Large, you have advantage on Strength checks, and your speed increases by 10 feet. Once you use this trait, you can\'t use it again until you finish a Long Rest.',
    'Storm\'s Thunder: When you take damage from a creature within 60 feet of you, you can use your Reaction to cause that creature to take 1d8 thunder damage. You can use this trait a number of times equal to your Proficiency Bonus, regaining all uses on a Long Rest.',
  ],
  visual: {
    id: 'storm_giant_goliath',
    icon: '⚡',
    color: '#4169E1',
    maleIllustrationPath: 'assets/images/races/Goliath_Storm Giant_Male.png',
    femaleIllustrationPath: 'assets/images/races/Goliath_Storm Giant_Female.png',
  },
};
