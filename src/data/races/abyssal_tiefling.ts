/**
 * @file abyssal_tiefling.ts
 * Defines the data for the Abyssal Legacy Tiefling race in the Aralia RPG.
 * Abyssal tieflings have poison-based magic from their demonic heritage.
 */
import { Race } from '../../types';

export const ABYSSAL_TIEFLING_DATA: Race = {
  id: 'abyssal_tiefling',
  name: 'Abyssal Tiefling',
  baseRace: 'tiefling',
  description:
    'Hailing from the chaos of the Abyss, this legacy grants resistance to poison and innate demonic magic. Those with the Abyssal Legacy often possess physical features like tusks, fur, or animalistic horns, reflecting the entropy and predatory nature of their demonic ancestors.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium or Small',
    'Speed: 30 feet',
    'Darkvision: You have Darkvision with a range of 60 feet.',
    'Otherworldly Presence: You know the Thaumaturgy cantrip.',
    'Abyssal Resistance: You have resistance to poison damage.',
    'Abyssal Magic: You know the Poison Spray cantrip. Starting at 3rd level, you can cast Ray of Sickness once per long rest. Starting at 5th level, you can cast Hold Person once per long rest. You can cast these spells without components, and can also cast them using any spell slots you have of the appropriate level. Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells (choose when you select this race).',
  ],
  visual: {
    id: 'abyssal_tiefling',
    icon: '👹',
    color: '#8B008B',
    maleIllustrationPath: 'assets/images/races/Tiefling_Abyssal_Male.png',
    femaleIllustrationPath: 'assets/images/races/Tiefling_Abyssal_Female.png',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'thaumaturgy' },
    { minLevel: 1, spellId: 'poison-spray' },
    { minLevel: 3, spellId: 'ray-of-sickness' },
    { minLevel: 5, spellId: 'hold-person' },
  ],
  racialSpellChoice: {
    traitName: 'Abyssal Magic',
    traitDescription: 'Choose Intelligence, Wisdom, or Charisma as your spellcasting ability for Abyssal Magic spells.',
  },
};
