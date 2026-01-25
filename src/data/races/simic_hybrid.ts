/**
 * @file simic_hybrid.ts
 * Defines the Simic Hybrid race.
 */
import { Race } from '../../types';

export const SIMIC_HYBRID_DATA: Race = {
  id: 'simic_hybrid',
  name: 'Simic Hybrid',
  baseRace: 'simic_hybrid',
  description:
    'Simic Hybrids are biologically altered beings from the Simic Combine, combining traits from multiple creatures.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Animal Enhancement (1st Level): You gain one animal trait right away; choices include climbing, swimming, gliding, or defense boosts.',
    'Animal Enhancement (5th Level): You gain a second enhancement at 5th level, chosen from the remaining options.',
  ],
  visual: {
    id: 'simic_hybrid',
    color: '#2f8d60',
    maleIllustrationPath: 'assets/images/races/simic_hybrid_male.png',
    femaleIllustrationPath: 'assets/images/races/simic_hybrid_female.png',
  },
};
