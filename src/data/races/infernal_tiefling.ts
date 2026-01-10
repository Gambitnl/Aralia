/**
 * @file infernal_tiefling.ts
 * Defines the data for the Infernal Legacy Tiefling race in the Aralia RPG.
 * Infernal tieflings have fire-based magic from their diabolic heritage.
 */
import { Race } from '../../types';

export const INFERNAL_TIEFLING_DATA: Race = {
  id: 'infernal_tiefling',
  name: 'Infernal Tiefling',
  baseRace: 'tiefling',
  description:
    'The structured hierarchy of the Nine Hells is the source of the Infernal Legacy. Tieflings of this bloodline often possess classic diabolic features—cloven hooves, tails, or pointed horns. They are gifted with magic that burns and binds, reflecting the lawful and punishing nature of their diabolic ancestors.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium or Small',
    'Speed: 30 feet',
    'Darkvision: You have Darkvision with a range of 60 feet.',
    'Otherworldly Presence: You know the Thaumaturgy cantrip.',
    'Infernal Resistance: You have resistance to fire damage.',
    'Infernal Magic: You know the Fire Bolt cantrip. Starting at 3rd level, you can cast Hellish Rebuke once per long rest. Starting at 5th level, you can cast Darkness once per long rest. You can cast these spells without components, and can also cast them using any spell slots you have of the appropriate level. Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells (choose when you select this race).',
  ],
  visual: {
    id: 'infernal_tiefling',
    icon: '😈',
    color: '#DC143C',
    maleIllustrationPath: 'assets/images/races/infernal_tiefling_male.png',
    femaleIllustrationPath: 'assets/images/races/infernal_tiefling_female.png',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'thaumaturgy' },
    { minLevel: 1, spellId: 'fire-bolt' },
    { minLevel: 3, spellId: 'hellish-rebuke' },
    { minLevel: 5, spellId: 'darkness' },
  ],
  racialSpellChoice: {
    traitName: 'Infernal Magic',
    traitDescription: 'Choose Intelligence, Wisdom, or Charisma as your spellcasting ability for Infernal Magic spells.',
  },
};
