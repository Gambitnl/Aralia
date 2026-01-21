/**
 * @file mountain_dwarf.ts
 * Defines the data for the Mountain Dwarf race in the Aralia RPG, based on Player's Handbook 2014.
 * Mountain dwarves are strong and hardy warriors, skilled in armor and weapons.
 */
import { Race } from '../../types';

export const MOUNTAIN_DWARF_DATA: Race = {
    id: 'mountain_dwarf',
    name: 'Mountain Dwarf',
    baseRace: 'dwarf',
    description:
        'Mountain dwarves are strong and hardy, accustomed to a difficult life in rugged terrain. They\'re probably on the tall side for a dwarf and tend toward lighter coloration. Mountain dwarves are known for their skill at warfare and their superior craftsmanship in armor and weapons. Their kingdoms, carved from the hearts of mountains, are renowned throughout the world. Mountain dwarves pride themselves on their martial traditions, with many clans maintaining elite military orders that have protected their holds for countless generations.',
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
        'Dwarven Armor Training: You have proficiency with light and medium armor.',
    ],
    imageUrl: 'assets/images/races/mountain_dwarf.png',
    visual: {
        id: 'mountain_dwarf',
        icon: '⛰️',
        color: '#808080',
        maleIllustrationPath: 'assets/images/races/Dwarf_Mountain_Male.png',
        femaleIllustrationPath: 'assets/images/races/Dwarf_Mountain_Female.png',
    },
};
