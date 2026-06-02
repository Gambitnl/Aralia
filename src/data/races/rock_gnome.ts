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
        'Rock gnomes possess a natural gift for invention and a hardiness that allows them to thrive in varied environments. Most gnomes in the worlds of D&D are rock gnomes, known for their inquisitive nature and boundless curiosity. They see engineering and alchemy as natural ways to explore the wonders of the multiverse.',
    abilityBonuses: [],
    traits: [
        'Creature Type: Humanoid',
        'Size: Small (about 3-4 feet tall)',
        'Speed: 30 feet',
        "Vision: You have [[darkvision|Darkvision]] with a range of 60 feet.",
        'Gnomish Cunning: You have [[advantage]] on Intelligence, Wisdom, and Charisma saving throws.',
        'Gnomish Lore: You have proficiency in the [[history|History]] skill. You also have [[advantage]] on Intelligence (History) checks you make to determine the origin and function of magic items, alchemical objects, or technological devices.',
        'Tinkering: You know the [[mending|Mending]] and [[prestidigitation|Prestidigitation]] cantrips. Intelligence, Wisdom, or Charisma is your spellcasting ability for them (choose when you select this species). As a part of casting Prestidigitation, you can create a Tiny clockwork device (AC 5, 1 HP), such as a toy, a fire starter, or a music box. The device ceases to function after 8 hours or when you dismantle it as a [[bonus_action|Bonus Action]].',
    ],
    imageUrl: 'assets/images/races/rock_gnome.png',
    visual: {
        id: 'rock_gnome',
    color: '#A0522D',
        maleIllustrationPath: 'assets/images/races/Gnome_Rock_Male.png',
        femaleIllustrationPath: 'assets/images/races/Gnome_Rock_Female.png',
    },
};
