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
        'Hill dwarves possess keen senses, deep intuition, and remarkable resilience. More connected to the surface world than their subterranean kin, they often build settlements into hillsides and rolling highlands. Their culture emphasizes wisdom and endurance, and they are known for their adaptability when interacting with other races. Like all dwarves, they take great pride in their craftsmanship and ancestral traditions.',
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
    imageUrl: 'assets/images/races/hill_dwarf.png',
    visual: {
        id: 'hill_dwarf',
        icon: '⛰️',
        color: '#8B4513',
        maleIllustrationPath: 'assets/images/races/Dwarf_Hill_Male.png',
        femaleIllustrationPath: 'assets/images/races/Dwarf_Hill_Female.png',
    },
};
