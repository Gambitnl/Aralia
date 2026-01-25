/**
 * @file hill_giant_goliath.ts
 * Defines the data for the Hill Giant Goliath race in the Aralia RPG.
 * Hill Giant goliaths can knock their enemies prone with powerful strikes.
 */
import { Race } from '../../types';

export const HILL_GIANT_GOLIATH_DATA: Race = {
  id: 'hill_giant_goliath',
  name: 'Hill Giant Goliath',
  baseRace: 'goliath',
  description:
    'As a goliath with Hill Giant ancestry, you possess the common traits of your people, enhanced by the massive strength of the hills. Your strikes carry a weight that can bowl over even the stoutest foes, making you a formidable presence in any melee. The raw, overwhelming power of hill giants pulses through your muscles, allowing you to knock down enemies with thunderous blows.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 7-8 feet tall)',
    'Speed: 35 feet',
    'Powerful Build: You have advantage on saving throws you make to end the Grappled condition. You also count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift.',
    'Large Form: Starting at 5th level, you can change your size to Large as a Bonus Action. This transformation lasts for 10 minutes or until you end it as a bonus action. While Large, you have advantage on Strength checks, and your speed increases by 10 feet. Once you use this trait, you can\'t use it again until you finish a Long Rest.',
    'Hill\'s Tumble: When you hit a Large or smaller creature with an attack roll, you can knock the target prone. You can use this trait a number of times equal to your Proficiency Bonus, regaining all uses on a Long Rest.',
  ],
  visual: {
    id: 'hill_giant_goliath',
    color: '#8B7355',
    maleIllustrationPath: 'assets/images/races/Goliath_Hill Giant_Male.png',
    femaleIllustrationPath: 'assets/images/races/Goliath_Hill Giant_Female.png',
  },
};
