/**
 * @file deep_gnome.ts
 * Defines the data for the Deep Gnome (Svirfneblin) race in the Aralia RPG, based on Mordenkainen's Tome of Foes.
 * Deep gnomes are natives of the Underdark with superior darkvision and natural camouflage abilities.
 */
import { Race } from '../../types';

export const DEEP_GNOME_DATA: Race = {
    id: 'deep_gnome',
    name: 'Deep Gnome (Svirfneblin)',
    baseRace: 'gnome',
    description:
        'Deep gnomes, or svirfneblin, are natives of the Underdark and are suffused with that subterranean realm\'s magic. They can supernaturally camouflage themselves, and their svirfneblin magic renders them difficult to locate. Deep gnomes are guarded and suspicious of outsiders, but intensely loyal to their friends.',
    abilityBonuses: [],
  traits: [
        'Creature Type: Humanoid',
        'Size: Small (about 3 feet tall)',
        'Speed: 30 feet',
        "Vision: You have [[darkvision|Darkvision]] with a range of 120 feet.",
    'Gnomish Cunning: You have [[advantage]] on Intelligence, Wisdom, and Charisma saving throws.',
    'Gnomish Camouflage: You have [[advantage]] on Dexterity (Stealth) checks. You can use this trait a number of times equal to your [[proficiency_bonus|Proficiency Bonus]], and you regain all expended uses when you finish a [[long_rest|Long Rest]].',
    'Gift of the Svirfneblin: You know the [[disguise_self|Disguise Self]] spell. Starting at 3rd level, you can cast the [[nondetection|Nondetection]] spell with this trait, without requiring a material component. You can cast each of these spells a number of times equal to your [[proficiency_bonus|Proficiency Bonus]] without using a spell slot, and you regain all expended uses when you finish a [[long_rest|Long Rest]]. Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells (choose when you select this species).',
  ],
  imageUrl: 'assets/images/races/deep_gnome.png',
    visual: {
        id: 'deep_gnome',
    color: '#696969',
        maleIllustrationPath: 'assets/images/races/Gnome_Deep_Male.png',
        femaleIllustrationPath: 'assets/images/races/Gnome_Deep_Female.png',
    },
  racialSpellChoice: {
    traitName: 'Gift of the Svirfneblin',
    traitDescription: 'Choose your spellcasting ability for Gift of the Svirfneblin (Intelligence, Wisdom, or Charisma).',
  },
  knownSpells: [
    {
      minLevel: 3,
      spellId: 'disguise-self',
      castingMethod: 'once_per_long_rest',
      spellAbility: 'subrace_choice',
      countsAsPrepared: false,
      maxCastLevel: 3,
      upcastable: false,
    },
    {
      minLevel: 5,
      spellId: 'nondetection',
      castingMethod: 'once_per_long_rest',
      spellAbility: 'subrace_choice',
      countsAsPrepared: false,
      maxCastLevel: 5,
      upcastable: false,
    },
  ],
};
