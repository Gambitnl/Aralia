/**
 * @file sea_elf.ts
 * Defines the data for the Sea Elf race in the Aralia RPG.
 * Sea elves have adapted to life beneath the waves with gills and webbed appendages.
 */
import { Race } from '../../types';

export const SEA_ELF_DATA: Race = {
  id: 'sea_elf',
  name: 'Sea Elf',
  baseRace: 'elf',
  description:
    'Sea elves fell in love with the wild beauty of the ocean in the earliest days of the multiverse. While other elves traveled from realm to realm, the sea elves navigated the deepest currents and explored the waters across a hundred worlds. Today, they live in small, hidden communities in the ocean shallows and on the Elemental Plane of Water. They have developed gills and webbed hands and feet, adapting perfectly to life beneath the waves. Sea elves maintain cordial relationships with their land-dwelling kin, though they may go decades without encountering them.',
  abilityBonuses: [], // Flexible ASIs handled by Point Buy.
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 5-6 feet tall)',
    'Speed: 30 feet, Swim 30 feet',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Fey Ancestry: You have advantage on saving throws you make to avoid or end the Charmed condition on yourself.',
    'Keen Senses: You have proficiency in the Perception skill.',
    'Trance: You don\'t need to sleep, and magic can\'t put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness.',
    'Child of the Sea: You can breathe air and water, and you have a swimming speed equal to your walking speed.',
    'Friend of the Sea: Aquatic animals have an extraordinary affinity with your people. You can communicate simple ideas to any Beast that has a swimming speed. It can understand your words, though you have no special ability to understand it in return.',
  ],
  imageUrl: 'assets/images/races/sea_elf.png',
  visual: {
    id: 'sea_elf',
    color: '#20B2AA',
    maleIllustrationPath: 'assets/images/races/Elf_Sea_Male.png',
    femaleIllustrationPath: 'assets/images/races/Elf_Sea_Female.png',
  },
};
