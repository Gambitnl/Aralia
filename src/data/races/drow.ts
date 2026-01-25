/**
 * @file drow.ts
 * Defines the data for the Drow (Dark Elf) race in the Aralia RPG, based on 2024 PHB.
 * Drow are descended from elves shaped by the Underdark or similar dark environments.
 */
import { Race } from '../../types';

export const DROW_DATA: Race = {
  id: 'drow',
  name: 'Drow',
  baseRace: 'elf',
  description:
    'Descended from elves shaped by the Underdark or similar dark environments, drow possess superior darkvision and unique innate magic. Also known as dark elves, they have adapted to life in the lightless depths beneath the world\'s surface. Drow societies are often complex and hierarchical, though many drow have broken free from such traditions to forge their own paths. Their connection to shadow and darkness grants them powerful magical abilities.',
  abilityBonuses: [], // Flexible ASIs handled by Point Buy.
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium (about 5-6 feet tall)',
    'Speed: 30 feet',
    "Vision: [[darkvision|Superior Darkvision]]. You can see in [[dim_light|dim light]] within 120 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Fey Ancestry: You have advantage on saving throws you make to avoid or end the Charmed condition on yourself.',
    'Keen Senses: You have proficiency in the Perception skill.',
    'Trance: You don\'t need to sleep, and magic can\'t put you to sleep. You can finish a Long Rest in 4 hours if you spend those hours in a trancelike meditation, during which you retain consciousness.',
    'Sunlight Sensitivity: You have disadvantage on attack rolls and on Wisdom (Perception) checks that rely on sight when you, the target of your attack, or whatever you are trying to perceive is in direct sunlight.',
    'Drow Magic: You know the Dancing Lights cantrip. At 3rd level, you learn the Faerie Fire spell. At 5th level, you learn the Darkness spell. You can cast each spell once without expending a spell slot, and you regain the ability to do so when you finish a Long Rest. Charisma is your spellcasting ability for these spells.',
  ],
  imageUrl: 'assets/images/races/drow.png',
  visual: {
    id: 'drow',
    color: '#800080',
    maleIllustrationPath: 'assets/images/races/Half-Elf_Drow_Male.png',
    femaleIllustrationPath: 'assets/images/races/Half-Elf_Drow_Female.png',
  },
};
