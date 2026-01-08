/**
 * @file eladrin.ts
 * Defines the data for the Eladrin race in the Aralia RPG.
 */
import { Race } from '../../types';

export const ELADRIN_DATA: Race = {
  id: 'eladrin',
  name: 'Eladrin',
  description:
    'Eladrin are elves of the Feywild, a realm of perilous beauty and boundless magic. Using that magic, eladrin can step from one place to another in the blink of an eye, and each eladrin resonates with emotions captured in the Feywild in the form of seasons—affinities that affect the eladrin’s mood and appearance. An eladrin’s season can change, though some remain in one season forever.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid. You are also considered an elf.',
    'Size: Medium',
    'Speed: 30 feet',
    'Darkvision: 60 feet',
    'Fey Ancestry: You have advantage on saving throws you make to avoid or end the charmed condition on yourself.',
    'Fey Step: As a bonus action, you can magically teleport up to 30 feet to an unoccupied space you can see. You can use this trait a number of times equal to your proficiency bonus, and you regain all expended uses when you finish a long rest. When you reach 3rd level, your Fey Step gains an additional effect based on your season (Autumn, Winter, Spring, or Summer). The save DC for these effects is 8 + your proficiency bonus + your chosen spellcasting modifier (Intelligence, Wisdom, or Charisma).',
    'Keen Senses: You have proficiency in the Perception skill.',
    'Trance: You don’t need to sleep... you can finish a long rest in 4 hours. Whenever you finish this trance, you can change your season, and you can gain two proficiencies that you don’t have, each one with a weapon or a tool of your choice.',
  ],
  visual: {
    id: 'eladrin',
    icon: '🍂',
    color: '#DA70D6',
    maleIllustrationPath: 'assets/images/races/eladrin_male.png',
    femaleIllustrationPath: 'assets/images/races/eladrin_female.png',
  },
  racialSpellChoice: {
    traitName: 'Fey Step',
    traitDescription: 'Choose the spellcasting ability for the save DC of your Fey Step’s additional effects.',
  }
};