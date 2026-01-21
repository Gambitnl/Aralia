/**
 * @file fire_giant_goliath.ts
 * Defines the data for the Fire Giant Goliath race in the Aralia RPG.
 * Fire Giant goliaths can add extra fire damage to their attacks.
 */
import { Race } from '../../types';

export const FIRE_GIANT_GOLIATH_DATA: Race = {
  id: 'fire_giant_goliath',
  name: 'Fire Giant Goliath',
  baseRace: 'goliath',
  description:
    'As a goliath with Fire Giant ancestry, you possess the common traits of your people, enhanced by the destructive power of flame that burns within your strikes. This heat is more than physical; it is a manifestation of your titanic heritage, allowing you to sear your foes with every successful blow. The forge-born strength of fire giants flows through your veins, making each attack a potential conflagration.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 7-8 feet tall)',
    'Speed: 35 feet',
    'Powerful Build: You have advantage on saving throws you make to end the Grappled condition. You also count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift.',
    'Large Form: Starting at 5th level, you can change your size to Large as a Bonus Action. This transformation lasts for 10 minutes or until you end it as a bonus action. While Large, you have advantage on Strength checks, and your speed increases by 10 feet. Once you use this trait, you can\'t use it again until you finish a Long Rest.',
    'Fire\'s Burn: When you hit a target with an attack roll, you can deal an extra 1d10 fire damage. You can use this trait a number of times equal to your Proficiency Bonus, regaining all uses on a Long Rest.',
  ],
  visual: {
    id: 'fire_giant_goliath',
    icon: '🔥',
    color: '#FF4500',
    maleIllustrationPath: 'assets/images/races/Goliath_Fire Giant_Male.png',
    femaleIllustrationPath: 'assets/images/races/Goliath_Fire Giant_Female.png',
  },
};
