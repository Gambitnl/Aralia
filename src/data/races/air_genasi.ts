
/**
 * @file air_genasi.ts
 * Defines the data for the Air Genasi race in the Aralia RPG, based on PHB 2024.
 * This includes their ID, name, description, and unique traits.
 * ASIs are handled flexibly during character creation, not as fixed racial bonuses.
 */
import { Race } from '../../types'; // Path relative to src/data/races/

// DATA FOR AIR GENASI
export const AIR_GENASI_DATA: Race = {
  id: 'air_genasi',
  name: 'Air Genasi',
  baseRace: 'genasi',
  description:
    'Air genasi are descended from djinn, the genies of the Elemental Plane of Air. They embody the airy traits of their otherworldly ancestors, from cloud-like hair to an innate connection with the winds, allowing them to remain calm and light in the face of any storm.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium',
    'Speed: 35 feet',
    'Unending Breath: You can hold your breath indefinitely while you are not Incapacitated.',
    'Lightning Resistance: You have Resistance to Lightning damage.',
    'Mingle with the Wind: You know the Shocking Grasp cantrip. You can cast Levitate (level 3) once per Long Rest without components.',
  ],
  visual: {
    id: 'air_genasi',
    icon: '💨',
    color: '#E0FFFF',
    maleIllustrationPath: 'assets/images/races/Genasi_Air_Male.png',
    femaleIllustrationPath: 'assets/images/races/Genasi_Air_Female.png',
  },
  racialSpellChoice: {
    traitName: 'Mingle with the Wind',
    traitDescription: 'Choose your spellcasting ability for these spells: Intelligence, Wisdom, or Charisma.',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'shocking-grasp' },
    { minLevel: 3, spellId: 'levitate' }
  ]
};
