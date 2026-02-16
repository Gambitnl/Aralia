
/**
 * @file earth_genasi.ts
 * Defines the data for the Earth Genasi race in the Aralia RPG.
 */
import { Race } from '../../types';

export const EARTH_GENASI_DATA: Race = {
  id: 'earth_genasi',
  name: 'Earth Genasi',
  baseRace: 'genasi',
  description:
    'Earth genasi trace their ancestry to dao, the genies of the Elemental Plane of Earth. They inherit a steadfast strength and a mystical control over the ground beneath their feet, allowing them to traverse even the most broken terrain with ease or magically harden their skin to resist harm.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 30 feet',
    'Earth Walk: You can move across Difficult Terrain without expending extra movement if you are walking on the ground or a floor.',
    'Merge with Stone: You know the Blade Ward cantrip. You can cast it as a Bonus Action a number of times equal to your Proficiency Bonus, regaining all uses on a Long Rest. Starting at 5th level, you can cast Pass without Trace once per long rest without components.',
  ],
  visual: {
    id: 'earth_genasi',
    color: '#8B4513',
    maleIllustrationPath: 'assets/images/races/Genasi_Earth_Male.png',
    femaleIllustrationPath: 'assets/images/races/Genasi_Earth_Female.png',
  },
  racialSpellChoice: {
    traitName: 'Merge with Stone',
    traitDescription: 'Choose your spellcasting ability for these spells: Intelligence, Wisdom, or Charisma.',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'blade-ward' },
    { minLevel: 5, spellId: 'pass-without-trace' }
  ]
};
