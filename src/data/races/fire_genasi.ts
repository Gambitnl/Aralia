
/**
 * @file fire_genasi.ts
 * Defines the data for the Fire Genasi race in the Aralia RPG, based on PHB 2024.
 */
import { Race } from '../../types';

export const FIRE_GENASI_DATA: Race = {
  id: 'fire_genasi',
  name: 'Fire Genasi',
  baseRace: 'genasi',
  description:
    'Descended from efreet, the genies of the Elemental Plane of Fire, fire genasi channel the flamboyant and often destructive nature of flame. Their skin often glows with embers or crackles with internal heat, and their hair can plume like threads of fire when they are angered or excited.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Fire Resistance: You have Resistance to Fire damage.',
    'Reach to the Blaze: You know the Produce Flame cantrip. Starting at 3rd level, you can cast Burning Hands once per long rest. Starting at 5th level, you can cast Flame Blade once per long rest. You can cast these spells without components, and can also cast them using any spell slots you have of the appropriate level.',
  ],
  visual: {
    id: 'fire_genasi',
    color: '#FF4500',
    maleIllustrationPath: 'assets/images/races/Genasi_Fire_Male.png',
    femaleIllustrationPath: 'assets/images/races/Genasi_Fire_Female.png',
  },
  racialSpellChoice: {
    traitName: 'Reach to the Blaze',
    traitDescription: 'Choose your spellcasting ability for these spells: Intelligence, Wisdom, or Charisma.',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'produce-flame' },
    { minLevel: 3, spellId: 'burning-hands' },
    { minLevel: 5, spellId: 'flame-blade' }
  ]
};
