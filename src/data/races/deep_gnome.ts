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
        'Deep gnomes, or svirfneblin, are natives of the Underdark and are suffused with that subterranean realm\'s magic. They can supernaturally camouflage themselves, and their svirfneblin magic renders them difficult to locate. Forest gnomes and rock gnomes are the gnomes most commonly encountered in the lands of the surface world. There is another subrace of gnomes rarely seen by any surface-dweller: deep gnomes, also known as svirfneblin. Guarded, and suspicious of outsiders, svirfneblin are cunning and taciturn, but can be just as kind-hearted, loyal, and compassionate as their surface cousins. When svirfneblin befriend someone, it is a friendship that lasts a lifetime.',
    abilityBonuses: [], // Flexible ASIs handled by Point Buy.
    traits: [
        'Creature Type: Humanoid',
        'Size: Small (about 3 feet tall)',
        'Speed: 25 feet',
        'Superior Darkvision: You can see in dim light within 120 feet of you as if it were bright light, and in darkness as if it were dim light. You can\'t discern color in darkness, only shades of gray.',
        'Gnome Cunning: You have Advantage on all Intelligence, Wisdom, and Charisma saving throws against magic.',
        'Stone Camouflage: You have Advantage on Dexterity (Stealth) checks to hide in rocky terrain.',
        'Gift of the Svirfneblin: Starting at 3rd level, you can cast the Disguise Self spell with this trait. Starting at 5th level, you can also cast the Nondetection spell with it, without requiring a material component. Once you cast either of these spells with this trait, you can\'t cast that spell with it again until you finish a Long Rest. You can also cast these spells using spell slots you have of the appropriate level. Intelligence, Wisdom, or Charisma is your spellcasting ability for these spells when you cast them with this trait (choose when you select this race).',
    ],
    imageUrl: 'assets/images/races/deep_gnome.png',
    visual: {
        id: 'deep_gnome',
        icon: '🪨',
        color: '#696969',
        maleIllustrationPath: 'assets/images/races/deep_gnome_male.png',
        femaleIllustrationPath: 'assets/images/races/deep_gnome_female.png',
    },
};
