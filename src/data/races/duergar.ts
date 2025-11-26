
/**
 * @file duergar.ts
 * Defines the data for the Duergar race in the Aralia RPG, based on Mordenkainen Presents: Monsters of the Multiverse, pg. 12.
 */
import { Race } from '../../types.ts'; // Path relative to src/data/races/

export const DUERGAR_DATA: Race = {
  id: 'duergar',
  name: 'Duergar',
  description:
    'Duergar are dwarves whose ancestors were transformed by centuries living in the deepest places of the Underdark. That chthonic realm is saturated with strange magical energy, and over generations, early duergar absorbed traces of it. They were further altered when mind flayers and other Aberrations invaded and performed horrific experiments on them. Fueled by Underdark magic, those experiments left early duergar with psionic powers, which have been passed down to their descendants. In time, they liberated themselves from their aberrant tyrants and forged a new life for themselves in the Underdark and beyond. Duergar typically have a life span of 350 years.',
  abilityBonuses: [], // Flexible ASIs are handled by the Point Buy system.
  traits: [
    'Creature Type: Humanoid. You are also considered a dwarf for any prerequisite or effect that requires you to be a dwarf.',
    'Size: Medium',
    'Speed: 30 feet',
    'Darkvision: You can see in dim light within 120 feet of you as if it were bright light and in darkness as if it were dim light. You discern colors in that darkness only as shades of gray.',
    'Duergar Magic: Starting at 3rd level, you can cast the Enlarge/Reduce spell on yourself with this trait, without requiring a material component. Starting at 5th level, you can also cast the Invisibility spell on yourself with this trait, without requiring a material component. Once you cast either of these spells with this trait, you can’t cast that spell with it again until you finish a long rest. You can also cast these spells using spell slots you have of the appropriate level. Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells (choose when you select this race).',
    'Dwarven Resilience: You have advantage on saving throws you make to avoid or end the poisoned condition on yourself. You also have resistance to poison damage.',
    'Psionic Fortitude: You have advantage on saving throws you make to avoid or end the charmed or stunned condition on yourself.',
  ],
  imageUrl: 'https://i.ibb.co/pcJsvJd/Duergar.png',
  racialSpellChoice: {
    traitName: 'Duergar Magic',
    traitDescription: 'Choose your spellcasting ability for Duergar Magic (Enlarge/Reduce, Invisibility).',
  },
  knownSpells: [
    { minLevel: 3, spellId: 'enlarge-reduce' },
    { minLevel: 5, spellId: 'invisibility' }
  ]
};
