/**
 * @file plasmoid.ts
 * Represents the Plasmoid ooze race.
 */
import { Race } from '../../types';

export const PLASMOID_DATA: Race = {
  id: 'plasmoid',
  name: 'Plasmoid',
  baseRace: 'plasmoid',
  description:
    'Plasmoids are amorphous ooze beings from Wildspace that can reshape their bodies at will while retaining a curious intelligence.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Ooze',
    'Size: Medium or Small',
    'Speed: 30 feet',
    'Darkvision: You can see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.',
    'Amorphous: You can squeeze through spaces as narrow as 1 inch wide when unencumbered and have advantage on checks to escape grapples.',
    'Hold Breath: You can hold your breath for up to 1 hour.',
    'Natural Resilience: You have resistance to acid and poison damage and advantage on saving throws against poison.',
    'Shape Self: As an action, you can reshape your body or revert it to its default form.',
  ],
  visual: {
    id: 'plasmoid',
    icon: '🌀',
    color: '#1d8ec4',
    maleIllustrationPath: 'assets/images/races/plasmoid_male.png',
    femaleIllustrationPath: 'assets/images/races/plasmoid_female.png',
  },
};
