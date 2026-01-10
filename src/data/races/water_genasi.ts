
/**
 * @file water_genasi.ts
 * Defines the data for the Water Genasi race in the Aralia RPG, based on PHB 2024.
 */
import { Race } from '../../types';

export const WATER_GENASI_DATA: Race = {
  id: 'water_genasi',
  name: 'Water Genasi',
  baseRace: 'genasi',
  description:
    'Water genasi descend from marids, aquatic genies from the Elemental Plane of Water. Perfectly suited for underwater life, they carry the power of the waves and can breathe as easily beneath the surface as they do above it. They are often found in coastal regions or deep beneath the ocean in coral cities.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet, Swim 30 feet',
    'Amphibious: You can breathe air and water.',
    'Acid Resistance: You have Resistance to Acid damage.',
    'Call to the Wave: You know the Acid Splash cantrip. Starting at 3rd level, you can cast Create or Destroy Water once per long rest. Starting at 5th level, you can cast Water Walk once per long rest. You can cast these spells without components, and can also cast them using any spell slots you have of the appropriate level.',
  ],
  visual: {
    id: 'water_genasi',
    icon: '💧',
    color: '#1E90FF',
    maleIllustrationPath: 'assets/images/races/water_genasi_male.png',
    femaleIllustrationPath: 'assets/images/races/water_genasi_female.png',
  },
  racialSpellChoice: {
    traitName: 'Call to the Wave',
    traitDescription: 'Choose your spellcasting ability for these spells: Intelligence, Wisdom, or Charisma.',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'acid-splash' },
    { minLevel: 3, spellId: 'create-or-destroy-water' },
    { minLevel: 5, spellId: 'water-walk' }
  ]
};
