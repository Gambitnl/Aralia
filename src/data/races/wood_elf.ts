/**
 * @file wood_elf.ts
 * Defines the data for the Wood Elf race in the Aralia RPG, based on 2024 PHB.
 * Wood elves embody the spirit of primeval forests and possess a primal connection to nature.
 */
import { Race } from '../../types';

export const WOOD_ELF_DATA: Race = {
  id: 'wood_elf',
  name: 'Wood Elf',
  baseRace: 'elf',
  description:
    'Embodying the spirit of primeval forests, wood elves are swift, perceptive, and possess a primal connection to nature. They are unmatched hunters and scouts, moving through woodlands with supernatural grace. Wood elf communities tend to be reclusive, preferring the company of ancient trees and wild creatures to the bustle of civilization. Their keen instincts and natural camouflage make them formidable guardians of the wild.',
  abilityBonuses: [], // Flexible ASIs handled by Point Buy.
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 5-6 feet tall)',
    'Speed: 35 feet',
    'Darkvision: You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can\'t discern color in darkness, only shades of gray.',
    'Fey Ancestry: You have advantage on saving throws you make to avoid or end the Charmed condition on yourself.',
    'Keen Senses: You have proficiency in the Perception skill.',
    'Trance: You don\'t need to sleep, and magic can\'t put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness.',
    'Fleet of Foot: Your base walking speed increases to 35 feet.',
    'Mask of the Wild: You can attempt to hide even when you are only lightly obscured by foliage, heavy rain, falling snow, mist, and other natural phenomena. You know the Druidcraft cantrip.',
    'Nature\'s Path: At 3rd level, you learn the Longstrider spell. At 5th level, you learn the Pass without Trace spell. You can cast each spell once without expending a spell slot, and you regain the ability to do so when you finish a Long Rest. Wisdom is your spellcasting ability for these spells.',
  ],
  imageUrl: 'assets/images/races/wood_elf.png',
  visual: {
    id: 'wood_elf',
    icon: '🌲',
    color: '#228B22',
    maleIllustrationPath: 'assets/images/races/wood_elf_male.png',
    femaleIllustrationPath: 'assets/images/races/wood_elf_female.png',
  },
};
