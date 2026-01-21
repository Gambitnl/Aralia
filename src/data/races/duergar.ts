
/**
 * @file duergar.ts
 * Defines the data for the Duergar race in the Aralia RPG, based on Mordenkainen Presents: Monsters of the Multiverse, pg. 12.
 */
import { Race } from '../../types'; // Path relative to src/data/races/

export const DUERGAR_DATA: Race = {
  id: 'duergar',
  name: 'Gray Dwarf (Duergar)',
  baseRace: 'dwarf',
  description:
    'Gray dwarves, or duergar, are a grim and ashen-skinned people who dwell in the deepest caverns far from sunlight. Their ancestors were transformed by centuries of exposure to strange subterranean energies and horrific experiments by aberrant creatures. These ordeals left them with innate psionic powers and an unshakable mental fortitude. Though they eventually won their freedom, their spirits were forever darkened. Duergar value toil, discipline, and obedience above all else, disdaining emotions other than grim determination. Their craftsmanship is impeccable but purely utilitarian, lacking any aesthetic flourish.',
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
  imageUrl: 'assets/images/races/duergar.png',
  visual: {
    id: 'duergar',
    icon: '⛏️',
    color: '#696969',
    maleIllustrationPath: 'assets/images/races/Duergar_Male.png',
    femaleIllustrationPath: 'assets/images/races/Duergar_Female.png',
  },
  racialSpellChoice: {
    traitName: 'Duergar Magic',
    traitDescription: 'Choose your spellcasting ability for Duergar Magic (Enlarge/Reduce, Invisibility).',
  },
  knownSpells: [
    { minLevel: 3, spellId: 'enlarge-reduce' },
    { minLevel: 5, spellId: 'invisibility' }
  ]
};
