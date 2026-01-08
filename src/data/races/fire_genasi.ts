
/**
 * @file fire_genasi.ts
 * Defines the data for the Fire Genasi race in the Aralia RPG.
 */
import { Race } from '../../types';

export const FIRE_GENASI_DATA: Race = {
  id: 'fire_genasi',
  name: 'Fire Genasi',
  description:
    'Descended from efreet, the genies of the Elemental Plane of Fire, fire genasi channel the flamboyant and often destructive nature of flame. They show their heritage in their skin tones, which can range from deep charcoal to shades of red and orange. Some bear skin tones common to humanity but with fiery marks, such as slowly swirling lights under their skin that resemble embers or glowing red lines tracing over their bodies like cracks. Fire genasi hair can resemble threads of fire or sooty smoke.',
  abilityBonuses: [],
  traits: [
    'Creature Type: Humanoid',
    'Size: Medium or Small',
    'Speed: 30 feet',
    'Darkvision: 60 feet',
    'Fire Resistance: You have resistance to fire damage.',
    'Reach to the Blaze: You know the produce flame cantrip. Starting at 3rd level, you can cast the burning hands spell with this trait. Starting at 5th level, you can also cast the flame blade spell with this trait, without requiring a material component. Once you cast burning hands or flame blade with this trait, you can’t cast that spell with it again until you finish a long rest. Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells (choose when you select this race).',
  ],
  visual: {
    id: 'fire_genasi',
    icon: '🔥',
    color: '#FF4500',
    maleIllustrationPath: 'assets/images/races/fire_genasi_male.png',
    femaleIllustrationPath: 'assets/images/races/fire_genasi_female.png',
  },
  racialSpellChoice: {
    traitName: 'Reach to the Blaze',
    traitDescription: 'Choose your spellcasting ability for Reach to the Blaze (Produce Flame, Burning Hands, Flame Blade).',
  },
  knownSpells: [
    { minLevel: 1, spellId: 'produce-flame' },
    { minLevel: 3, spellId: 'burning-hands' },
    { minLevel: 5, spellId: 'flame-blade' }
  ]
};
