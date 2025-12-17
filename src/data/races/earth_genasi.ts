
/**
 * @file earth_genasi.ts
 * Defines the data for the Earth Genasi race in the Aralia RPG.
 */
import { Race } from '../../types';

export const EARTH_GENASI_DATA: Race = {
  id: 'earth_genasi',
  name: 'Earth Genasi',
  description:
    'Tracing their ancestry to dao, the genies of the Elemental Plane of Earth, earth genasi inherit dao’s steadfast strength and control over earth. An earth genasi’s skin can be the colors of stone and earth or a human skin tone with glittering sparkles like gem dust. Some earth genasi have lines marking their skin like cracks, either showing glimmering gemlike veins or a dim, yellowish glow. Earth genasi hair can appear carved of stone or crystal or resemble strands of spun metal.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium or Small',
    'Speed: 30 feet',
    'Darkvision: 60 feet',
    'Earth Walk: You can move across difficult terrain without expending extra movement if you are using your walking speed on the ground or a floor.',
    'Merge with Stone: You know the blade ward cantrip. You can cast it as normal, and you can also cast it as a bonus action a number of times equal to your proficiency bonus, regaining all expended uses when you finish a long rest. Starting at 5th level, you can cast the pass without trace spell with this trait, without requiring a material component. Once you cast that spell with this trait, you can’t do so again until you finish a long rest. Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells (choose when you select this race).',
  ],
  racialSpellChoice: {
    traitName: 'Merge with Stone',
    traitDescription: 'Choose your spellcasting ability for Merge with Stone (Blade Ward, Pass without Trace).',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'blade-ward' },
    { minLevel: 5, spellId: 'pass-without-trace' }
  ]
};
