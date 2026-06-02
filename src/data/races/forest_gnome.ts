/**
 * @file forest_gnome.ts
 * Defines the data for the Forest Gnome race in the Aralia RPG, based on Player's Handbook 2014.
 * Forest gnomes have a natural knack for illusion and can communicate with small beasts.
 */
import { Race } from '../../types';

export const FOREST_GNOME_DATA: Race = {
    id: 'forest_gnome',
    name: 'Forest Gnome',
    baseRace: 'gnome',
    description:
        'As a forest gnome, you have a natural gift for illusion and an inherent quickness. Often found in hidden sylvan communities, you use your trickery to remain unseen and protect the woodland creatures you call friends. Forest gnomes are quick-witted and cautious around strangers, valuing their mossy glades and hidden burrows.',
    abilityBonuses: [],
    traits: [
        'Creature Type: Humanoid',
        'Size: Small (about 3-4 feet tall)',
        'Speed: 30 feet',
        "Vision: You have [[darkvision|Darkvision]] with a range of 60 feet.",
        'Gnomish Cunning: You have [[advantage]] on Intelligence, Wisdom, and Charisma saving throws.',
        'Natural Illusionist: You know the [[minor_illusion|Minor Illusion]] cantrip. Intelligence, Wisdom, or Charisma is your spellcasting ability for it (choose when you select this species).',
        'Speak with Animals: You can cast the [[speak_with_animals|Speak with Animals]] spell. You can cast it a number of times equal to your [[proficiency_bonus|Proficiency Bonus]] without using a spell slot, and you regain all expended uses when you finish a [[long_rest|Long Rest]]. Intelligence, Wisdom, or Charisma is your spellcasting ability for it (choose when you select this species).',
    ],
    imageUrl: 'assets/images/races/forest_gnome.png',
    visual: {
        id: 'forest_gnome',
    color: '#228B22',
        maleIllustrationPath: 'assets/images/races/Gnome_Forest_Male.png',
        femaleIllustrationPath: 'assets/images/races/Gnome_Forest_Female.png',
    },
};
