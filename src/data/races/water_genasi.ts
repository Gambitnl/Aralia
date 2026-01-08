
/**
 * @file water_genasi.ts
 * Defines the data for the Water Genasi race in the Aralia RPG.
 */
import { Race } from '../../types';

export const WATER_GENASI_DATA: Race = {
  id: 'water_genasi',
  name: 'Water Genasi',
  description:
    'Water genasi descend from marids, aquatic genies from the Elemental Plane of Water. Water genasi are perfectly suited to life underwater and carry the power of the waves inside themselves. Their skin is often shades of blue or green, sometimes a blend of the two. If they have a human skin tone, there is a glistening texture that catches the light, like water droplets or nearly invisible fish scales. Their hair can resemble seaweed, waving as if in a current, or it can even be like water itself.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium or Small',
    'Speed: 30 feet, and you have a swimming speed equal to your walking speed.',
    'Acid Resistance: You have resistance to acid damage.',
    'Amphibious: You can breathe air and water.',
    'Call to the Wave: You know the acid splash cantrip. Starting at 3rd level, you can cast the create or destroy water spell with this trait. Starting at 5th level, you can also cast the water walk spell with this trait, without requiring a material component. Once you cast create or destroy water or water walk with this trait, you can’t cast that spell with it again until you finish a long rest. Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells (choose when you select this race).',
    'Darkvision: 60 feet',
  ],
  racialSpellChoice: {
    traitName: 'Call to the Wave',
    traitDescription: 'Choose your spellcasting ability for Call to the Wave (Acid Splash, Create or Destroy Water, Water Walk).',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'acid-splash' },
    { minLevel: 3, spellId: 'create-or-destroy-water' },
    { minLevel: 5, spellId: 'water-walk' }
  ],
  visual: {
    id: 'water_genasi',
    icon: '💧',
    color: '#4682B4',
    maleIllustrationPath: 'assets/images/races/water_genasi_male.png',
    femaleIllustrationPath: 'assets/images/races/water_genasi_female.png',
  },
};
