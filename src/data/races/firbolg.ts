
/**
 * @file firbolg.ts
 * Defines the data for the Firbolg race in the Aralia RPG.
 */
import { Race } from '../../types';

export const FIRBOLG_DATA: Race = {
  id: 'firbolg',
  name: 'Firbolg',
  description:
    'Distant cousins of giants, the first firbolgs wandered the primeval forests of the multiverse, and the magic of those forests entwined itself with the firbolgs’ souls. Centuries later, that magic still thrums inside a firbolg, even one who has never lived under the boughs of a great forest. A firbolg’s magic is an obscuring sort, which allowed their ancestors to pass through a forest without disturbing it. So deep is the connection between a firbolg and the wild places of the world that they can communicate with flora and fauna.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Firbolg Magic: You can cast the detect magic and disguise self spells with this trait. When you use this version of disguise self, you can seem up to 3 feet shorter or taller. Once you cast either of these spells with this trait, you can’t cast that spell with it again until you finish a long rest. Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells (choose when you select this race).',
    'Hidden Step: As a bonus action, you can magically turn invisible until the start of your next turn or until you attack, make a damage roll, or force someone to make a saving throw. You can use this trait a number of times equal to your proficiency bonus, and you regain all expended uses when you finish a long rest.',
    'Powerful Build: You count as one size larger when determining your carrying capacity and the weight you can push, drag, or lift.',
    'Speech of Beast and Leaf: You have the ability to communicate in a limited manner with Beasts, Plants, and vegetation. They can understand the meaning of your words, though you have no special ability to understand them in return. You have advantage on all Charisma checks you make to influence them.',
  ],
  visual: {
    id: 'firbolg',
    icon: '🌲',
    color: '#6B8E23',
    maleIllustrationPath: 'assets/images/races/Firbolg_Male.png',
    femaleIllustrationPath: 'assets/images/races/Firbolg_Female.png',
  },
  racialSpellChoice: {
    traitName: 'Firbolg Magic',
    traitDescription: 'Choose your spellcasting ability for Firbolg Magic (Detect Magic, Disguise Self).',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'detect-magic' },
    { minLevel: 1, spellId: 'disguise-self' }
  ]
};
