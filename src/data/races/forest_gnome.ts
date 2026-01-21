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
        'As a forest gnome, you have a natural knack for illusion and inherent quickness and stealth. In the world\'s forests, a visitor might feel being watched by unseen eyes. Those eyes might belong to a forest gnome. Forest gnomes are rare and secretive. They gather in hidden communities in sylvan forests, using illusions and trickery to conceal themselves from threats or to mask their escape should they be detected. Forest gnomes tend to be friendly with other good-spirited woodland folk, and they regard elves and good fey as their most important allies. These gnomes also befriend small forest animals and rely on them for information about threats that might prowl their lands.',
    abilityBonuses: [], // Flexible ASIs handled by Point Buy.
    traits: [
        'Creature Type: Humanoid',
        'Size: Small (about 3-4 feet tall)',
        'Speed: 25 feet',
        'Darkvision: You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can\'t discern color in darkness, only shades of gray.',
        'Gnome Cunning: You have Advantage on all Intelligence, Wisdom, and Charisma saving throws against magic.',
        'Natural Illusionist: You know the Minor Illusion cantrip. Intelligence is your spellcasting ability for it.',
        'Speak with Small Beasts: Through sounds and gestures, you can communicate simple ideas with Small or smaller beasts. Forest gnomes love animals and often keep squirrels, badgers, rabbits, moles, woodpeckers, and other creatures as beloved pets.',
    ],
    imageUrl: 'assets/images/races/forest_gnome.png',
    visual: {
        id: 'forest_gnome',
        icon: '🦝',
        color: '#228B22',
        maleIllustrationPath: 'assets/images/races/Gnome_Forest_Male.png',
        femaleIllustrationPath: 'assets/images/races/Gnome_Forest_Female.png',
    },
};
