/**
 * @file high_elf.ts
 * Defines the data for the High Elf race in the Aralia RPG.
 * High elves are heirs to elves infused with magic of the Feywild or similar mystical places.
 */
import { Race } from '../../types';

export const HIGH_ELF_DATA: Race = {
  id: 'high_elf',
  name: 'High Elf',
  baseRace: 'elf',
  description:
    'Heirs to elves infused with the magic of the Feywild or similar mystical places, high elves are naturally adept at arcane arts. They possess an innate understanding of wizardry and often pursue scholarly endeavors. Their societies value knowledge, art, and the refinement of magical skills, making them some of the most accomplished spellcasters among elvenkind.',
  abilityBonuses: [], // Flexible ASIs handled by Point Buy.
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 5-6 feet tall)',
    'Speed: 30 feet',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Fey Ancestry: You have advantage on saving throws you make to avoid or end the Charmed condition on yourself.',
    'Keen Senses: You have proficiency in the Perception skill.',
    'Trance: You don\'t need to sleep, and magic can\'t put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness.',
    'High Elf Cantrip: You know the Prestidigitation cantrip (or another Wizard cantrip of your choice). You can replace it with a different Wizard cantrip after finishing a Long Rest. Intelligence is your spellcasting ability for it.',
    'Wizard Tradition: At 3rd level, you learn the Detect Magic spell. At 5th level, you learn the Misty Step spell. You can cast each spell once without expending a spell slot, and you regain the ability to do so when you finish a Long Rest. Intelligence is your spellcasting ability for these spells.',
  ],
  imageUrl: 'assets/images/races/high_elf.png',
  visual: {
    id: 'high_elf',
    color: '#E6E6FA',
    maleIllustrationPath: 'assets/images/races/Elf_High_Male.png',
    femaleIllustrationPath: 'assets/images/races/Elf_High_Female.png',
  },
};
