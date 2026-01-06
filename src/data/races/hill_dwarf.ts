/**
 * @file hill_dwarf.ts
 * Defines the data for the Hill Dwarf race in the Aralia RPG, based on Player's Handbook 2014.
 * Hill dwarves are known for their keen senses and remarkable resilience.
 */
import { Race } from '../../types';

export const HILL_DWARF_DATA: Race = {
    id: 'hill_dwarf',
    name: 'Hill Dwarf',
    baseRace: 'dwarf',
    description:
        'As a hill dwarf, you have keen senses, deep intuition, and remarkable resilience. The gold dwarves of Faerûn in their mighty southern kingdom are hill dwarves, as are the exiled Neidar and the debased Klar of Krynn in the Dragonlance setting.',
    abilityBonuses: [], // Flexible ASIs handled by Point Buy.
    traits: [
        'Creature Type: Humanoid',
        'Size: Medium (about 4-5 feet tall)',
        'Speed: 25 feet. Your speed is not reduced by wearing heavy armor.',
        'Darkvision: You have Darkvision with a range of 60 feet.',
        'Dwarven Resilience: You have Advantage on saving throws against poison, and you have Resistance to poison damage.',
        'Dwarven Combat Training: You have proficiency with the battleaxe, handaxe, light hammer, and warhammer.',
        'Tool Proficiency: You gain proficiency with the artisan\'s tools of your choice: smith\'s tools, brewer\'s supplies, or mason\'s tools.',
        'Stonecunning: Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus to the check.',
        'Dwarven Toughness: Your hit point maximum increases by 1, and it increases by 1 every time you gain a level.',
    ],
    imageUrl: 'https://i.ibb.co/4n5pV7k2/Dwarf.png', // Reuse dwarf image for now
};
