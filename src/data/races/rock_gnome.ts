/**
 * @file rock_gnome.ts
 * Defines the data for the Rock Gnome race in the Aralia RPG, based on Player's Handbook 2014.
 * Rock gnomes are natural inventors and tinkerers with a love for gadgets and machines.
 */
import { Race } from '../../types';

export const ROCK_GNOME_DATA: Race = {
    id: 'rock_gnome',
    name: 'Rock Gnome',
    baseRace: 'gnome',
    description:
        'As a rock gnome, you have a natural inventiveness and hardiness beyond that of other gnomes. Most gnomes in the worlds of D&D are rock gnomes, including the tinker gnomes of the Dragonlance setting. Rock gnomes are inquisitive and vivacious, and their love of jokes, pranks, and all things mechanical makes them an endearing, if sometimes frustrating, presence. They see engineering, alchemy, and similar pursuits as natural outgrowths of their boundless curiosity and drive to discover the world\'s wonders. Rock gnomes create delightful toys and practical gadgets, from music boxes and mechanical birds to complex devices and peculiar inventions.',
    abilityBonuses: [], // Flexible ASIs handled by Point Buy.
    traits: [
        'Creature Type: Humanoid',
        'Size: Small (about 3-4 feet tall)',
        'Speed: 25 feet',
        'Darkvision: You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can\'t discern color in darkness, only shades of gray.',
        'Gnome Cunning: You have Advantage on all Intelligence, Wisdom, and Charisma saving throws against magic.',
        'Artificer\'s Lore: Whenever you make an Intelligence (History) check related to magic items, alchemical objects, or technological devices, you can add twice your proficiency bonus, instead of any proficiency bonus you normally apply.',
        'Tinker: You have proficiency with artisan\'s tools (tinker\'s tools). Using those tools, you can spend 1 hour and 10 gp worth of materials to construct a Tiny clockwork device (AC 5, 1 hp). The device ceases to function after 24 hours (unless you spend 1 hour repairing it to keep the device functioning), or when you use your action to dismantle it; at that time, you can reclaim the materials used to create it. You can have up to three such devices active at a time. When you create a device, choose one of the following options: Clockwork Toy (a clockwork animal, monster, or person that moves 5 feet across solid ground when touched), Fire Starter (produces a miniature flame for lighting candles, torches, or campfires), or Music Box (plays a single song at a moderate volume when opened).',
    ],
    imageUrl: 'assets/images/races/rock_gnome.png',
    visual: {
        id: 'rock_gnome',
        icon: '⚙️',
        color: '#A0522D',
        maleIllustrationPath: 'assets/images/races/rock_gnome_male.png',
        femaleIllustrationPath: 'assets/images/races/rock_gnome_female.png',
    },
};
