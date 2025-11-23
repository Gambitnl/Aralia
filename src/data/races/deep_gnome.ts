
/**
 * @file deep_gnome.ts
 * Defines the data for the Deep Gnome race in the Aralia RPG, based on Mordenkainen Presents: Monsters of the Multiverse, pg. 11.
 * This is a distinct primary race choice, not a subrace of the standard Gnome.
 */
import { Race } from '../../types'; // Path relative to src/data/races/

export const DEEP_GNOME_DATA: Race = {
  id: 'deep_gnome',
  name: 'Deep Gnome (Svirfneblin)',
  description:
    'Deep gnomes, or svirfneblin, are natives of the Underdark and are suffused with that subterranean realm’s magic. They can supernaturally camouflage themselves, and their svirfneblin magic renders them difficult to locate. These abilities have enabled them to survive for generations among the perils of the Underdark. Like other gnomes, deep gnomes can live for centuries, up to 500 years.',
  abilityBonuses: [], // Flexible ASIs are handled by the Point Buy system.
  traits: [
    'Creature Type: Humanoid. You are also considered a gnome for any prerequisite or effect that requires you to be a gnome.',
    'Size: Small',
    'Speed: 30 feet',
    'Darkvision: You can see in dim light within 120 feet of you as if it were bright light and in darkness as if it were dim light. You discern colors in that darkness only as shades of gray.',
    'Gift of the Svirfneblin: Starting at 3rd level, you can cast the Disguise Self spell with this trait. Starting at 5th level, you can also cast the Nondetection spell with it, without requiring a material component. Once you cast either of these spells with this trait, you can’t cast that spell with it again until you finish a long rest. You can also cast these spells using spell slots you have of the appropriate level. Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells when you cast them with this trait (choose when you select this race).',
    'Gnomish Magic Resistance: You have advantage on Intelligence, Wisdom, and Charisma saving throws against spells.',
    'Svirfneblin Camouflage: When you make a Dexterity (Stealth) check, you can make the check with advantage. You can use this trait a number of times equal to your proficiency bonus, and you regain all expended uses when you finish a long rest.',
  ],
  imageUrl: 'https://i.ibb.co/4ZKnbKXY/Deep-Gnome.png',
  racialSpellChoice: {
    traitName: 'Gift of the Svirfneblin',
    traitDescription: 'Choose your spellcasting ability for Gift of the Svirfneblin (Disguise Self, Nondetection).',
  },
  knownSpells: [
    { minLevel: 3, spellId: 'disguise-self' },
    { minLevel: 5, spellId: 'nondetection' }
  ]
};
