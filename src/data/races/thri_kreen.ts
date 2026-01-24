/**
 * @file thri_kreen.ts
 * Defines the Thri-kreen race.
 */
import { Race } from '../../types';

export const THRI_KREEN_DATA: Race = {
  id: 'thri_kreen',
  name: 'Thri-kreen',
  baseRace: 'beastfolk',
  description:
    'Thri-kreen are insectoid nomads from Athas and Wildspace, defined by their multiple limbs, carapace armor, and constant vigilance.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Monstrosity',
    'Size: Medium or Small',
    'Speed: 30 feet',
    'Darkvision: You can see in dim light within 60 feet as bright light and in darkness as dim light.',
    'Chameleon Carapace: While unarmored, your base AC is 13 + your Dexterity modifier, and you can change color to gain advantage on Stealth checks once per rest.',
    'Secondary Arms: You possess two smaller arms that let you manipulate objects, open doors, or hold tools.',
    'Sleepless: You do not require sleep during a long rest, though you must remain still to gain its benefits.',
    'Thri-kreen Telepathy: You can communicate telepathically with any creature within 120 feet that understands a language and can see you.',
  ],
  visual: {
    id: 'thri_kreen',
    icon: '🕷️',
    color: '#5a7a5a',
    maleIllustrationPath: 'assets/images/Placeholder.jpg',
    femaleIllustrationPath: 'assets/images/Placeholder.jpg',
  },
};
