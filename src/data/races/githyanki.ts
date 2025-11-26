
/**
 * @file githyanki.ts
 * Defines the data for the Githyanki race in the Aralia RPG.
 */
import { Race } from '../../types.ts';

export const GITHYANKI_DATA: Race = {
  id: 'githyanki',
  name: 'Githyanki',
  description:
    'Once members of a people who escaped servitude to mind flayers, githyanki split from their cousins, githzerai, and fled to the Astral Plane. In that timeless, silvery realm, githyanki honed their psionic powers and built a great city called Tu’narath. They have since spread throughout the multiverse, starting in outposts outside the Astral Plane, called creches, where time passes and their children can reach adulthood.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Astral Knowledge: Whenever you finish a long rest, you gain proficiency in one skill of your choice and with one weapon or tool of your choice, selected from the Player’s Handbook. These proficiencies last until the end of your next long rest.',
    'Githyanki Psionics: You know the mage hand cantrip, and the hand is invisible when you cast the cantrip with this trait. Starting at 3rd level, you can cast the jump spell with this trait. Starting at 5th level, you can also cast the misty step spell with it. Once you cast jump or misty step with this trait, you can’t cast that spell with it again until you finish a long rest. Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells (choose when you select this race).',
    'Psychic Resilience: You have resistance to psychic damage.',
  ],
  racialSpellChoice: {
    traitName: 'Githyanki Psionics',
    traitDescription: 'Choose your spellcasting ability for Githyanki Psionics (Mage Hand, Jump, Misty Step).',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'mage-hand' },
    { minLevel: 3, spellId: 'jump' },
    { minLevel: 5, spellId: 'misty-step' }
  ]
};
