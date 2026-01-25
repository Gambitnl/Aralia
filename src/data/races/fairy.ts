
/**
 * @file fairy.ts
 * Defines the data for the Fairy race in the Aralia RPG.
 */
import { Race } from '../../types';

export const FAIRY_DATA: Race = {
  id: 'fairy',
  name: 'Fairy',
  description:
    'The Feywild is home to many fantastic peoples, including fairies. Fairies are a wee folk, but not nearly as much so as their pixie and sprite friends. The first fairies spoke Elvish, Goblin, or Sylvan, and encounters with human visitors prompted many of them to learn Common as well. Infused with the magic of the Feywild, most fairies look like Small elves with insectile wings, but each fairy has a special physical characteristic that sets the fairy apart.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Fey',
    'Size: Small',
    'Speed: 30 feet',
    'Fairy Magic: You know the druidcraft cantrip. Starting at 3rd level, you can cast the faerie fire spell with this trait. Starting at 5th level, you can also cast the enlarge/reduce spell with this trait. Once you cast faerie fire or enlarge/reduce with this trait, you can’t cast that spell with it again until you finish a long rest. Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells (choose when you select this race).',
    'Flight: Because of your wings, you have a flying speed equal to your walking speed. You can’t use this flying speed if you’re wearing medium or heavy armor.',
  ],
  visual: {
    id: 'fairy',
    color: '#FF69B4',
    maleIllustrationPath: 'assets/images/races/Fairy_Male.png',
    femaleIllustrationPath: 'assets/images/races/Fairy_Female.png',
  },
  racialSpellChoice: {
    traitName: 'Fairy Magic',
    traitDescription: 'Choose your spellcasting ability for Fairy Magic (Druidcraft, Faerie Fire, Enlarge/Reduce).',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'druidcraft' },
    { minLevel: 3, spellId: 'faerie-fire' },
    { minLevel: 5, spellId: 'enlarge-reduce' }
  ]
};
