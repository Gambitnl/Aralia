/**
 * @file kobold.ts
 * Defines the Kobold race for the creator.
 */
import { Race } from '../../types';

export const KOBOLD_DATA: Race = {
  id: 'kobold',
  name: 'Kobold',
  baseRace: 'kobold',
  description:
    'Kobolds are clever, draconic cousins with a strong communal spirit who rely on cunning tactics more than brute force in battle.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Small',
    'Speed: 30 feet',
    'Draconic Cry: As a bonus action, you can let out a cry that grants you and allies within 10 feet temporary advantage on attacks until the end of your turn.',
    'Kobold Legacy: You possess a draconic legacy that grants you either Craftiness (skill proficiency), Defiance (advantage on saving throws vs. fear), or another legacy benefit determined by DM.',
  ],
  visual: {
    id: 'kobold',
    icon: '🐲',
    color: '#7f3300',
    maleIllustrationPath: 'assets/images/races/kobold_male.png',
    femaleIllustrationPath: 'assets/images/races/kobold_female.png',
  },
};
