/**
 * @file chthonic_tiefling.ts
 * Defines the data for the Chthonic Legacy Tiefling race in the Aralia RPG.
 * Chthonic tieflings have necrotic magic from their connection to Hades and Gehenna.
 */
import { Race } from '../../types';

export const CHTHONIC_TIEFLING_DATA: Race = {
  id: 'chthonic_tiefling',
  name: 'Chthonic Tiefling',
  baseRace: 'tiefling',
  description:
    'Linked to the gloom of Hades and Gehenna, this legacy grants resistance to necrotic energy and spectral magic. Those with the Chthonic Legacy find their roots in the Gloom Wrought or the gray wastes of Hades, often possessing a deathly pallor or cold, dark eyes that reflect the somber power of their neutral evil heritage.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium or Small',
    'Speed: 30 feet',
    "Vision: You can see in [[dim_light|dim light]] within 60 feet of you as if it were [[bright_light|bright light]], and in [[darkness]] as if it were [[dim_light|dim light]]. You can't discern color in [[darkness]], only shades of gray.",
    'Otherworldly Presence: You know the Thaumaturgy cantrip.',
    'Chthonic Resistance: You have resistance to necrotic damage.',
    'Chthonic Magic: You know the Chill Touch cantrip. Starting at 3rd level, you can cast False Life once per long rest. Starting at 5th level, you can cast Ray of Enfeeblement once per long rest. You can cast these spells without components, and can also cast them using any spell slots you have of the appropriate level. Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells (choose when you select this race).',
  ],
  visual: {
    id: 'chthonic_tiefling',
    color: '#696969',
    maleIllustrationPath: 'assets/images/races/Tiefling_Chthonic_Male.png',
    femaleIllustrationPath: 'assets/images/races/Tiefling_Chthonic_Female.png',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'thaumaturgy' },
    { minLevel: 1, spellId: 'chill-touch' },
    { minLevel: 3, spellId: 'false-life' },
    { minLevel: 5, spellId: 'ray-of-enfeeblement' },
  ],
  racialSpellChoice: {
    traitName: 'Chthonic Magic',
    traitDescription: 'Choose Intelligence, Wisdom, or Charisma as your spellcasting ability for Chthonic Magic spells.',
  },
};
