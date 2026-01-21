/**
 * @file cloud_giant_goliath.ts
 * Defines the data for the Cloud Giant Goliath race in the Aralia RPG.
 * Cloud Giant goliaths can teleport short distances, embodying the grace of sky-dwellers.
 */
import { Race } from '../../types';

export const CLOUD_GIANT_GOLIATH_DATA: Race = {
  id: 'cloud_giant_goliath',
  name: 'Cloud Giant Goliath',
  baseRace: 'goliath',
  description:
    'As a goliath with Cloud Giant ancestry, you possess the grace and magic of the sky-dwellers. You can step through the air as easily as a cloud moves with the wind, allowing for sudden and supernatural repositioning on the battlefield. Towering over most folk, you are a distant descendant of giants, bearing the favor of cloud giants—manifesting as the ability to teleport across short distances with ease.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 7-8 feet tall)',
    'Speed: 35 feet',
    'Powerful Build: You have advantage on saving throws you make to end the Grappled condition. You also count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift.',
    'Large Form: Starting at 5th level, you can change your size to Large as a Bonus Action. This transformation lasts for 10 minutes or until you end it as a bonus action. While Large, you have advantage on Strength checks, and your speed increases by 10 feet. Once you use this trait, you can\'t use it again until you finish a Long Rest.',
    'Cloud\'s Jaunt: As a Bonus Action, you can magically teleport up to 30 feet to an unoccupied space you can see. You can use this trait a number of times equal to your Proficiency Bonus, regaining all uses on a Long Rest.',
  ],
  visual: {
    id: 'cloud_giant_goliath',
    icon: '☁️',
    color: '#B0C4DE',
    maleIllustrationPath: 'assets/images/races/Goliath_Cloud Giant_Male.png',
    femaleIllustrationPath: 'assets/images/races/Goliath_Cloud Giant_Female.png',
  },
};
