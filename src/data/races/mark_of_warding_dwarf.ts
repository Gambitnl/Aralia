/**
 * @file mark_of_warding_dwarf.ts
 * Defines the data for the Mark of Warding Dwarf race in the Aralia RPG.
 * Dwarves with the Mark of Warding are masters of locks, traps, and protective magic.
 */
import { Race } from '../../types';

export const MARK_OF_WARDING_DWARF_DATA: Race = {
    id: 'mark_of_warding_dwarf',
    name: 'Mark of Warding Dwarf',
    baseRace: 'dwarf',
    description:
        'Etched with a sigil that pulses with protective energy, dwarves bearing the Mark of Warding are natural guardians and vault keepers. This hereditary gift grants them mastery over locks, wards, and protective enchantments, allowing them to create barriers that few can breach. Their mark glows when they craft magical seals or detect threats to what they guard. These marked dwarves are sought after as security specialists, vault masters, and protectors of valuable secrets, their innate understanding of defensive magic making them unmatched guardians.',
    abilityBonuses: [], // Flexible ASIs handled by Point Buy.
    traits: [
        'Creature Type: Humanoid',
        'Size: Medium (about 4-5 feet tall)',
        'Speed: 25 feet. Your speed is not reduced by wearing heavy armor.',
        'Darkvision: You have Darkvision with a range of 60 feet.',
        'Dwarven Resilience: You have Advantage on saving throws against poison, and you have Resistance to poison damage.',
        'Tool Proficiency: You gain proficiency with the artisan\'s tools of your choice: smith\'s tools, brewer\'s supplies, or mason\'s tools.',
        'Stonecunning: Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus to the check.',
        'Warder\'s Intuition: When you make an Intelligence (Investigation) check or an ability check using thieves\' tools, you can roll a d4 and add the number rolled to the ability check.',
        'Wards and Seals: You can cast the Alarm and Mage Armor spells with this trait. Starting at 3rd level, you can also cast the Arcane Lock spell with it. Once you cast any of these spells with this trait, you can\'t cast that spell with it again until you finish a Long Rest. Intelligence is your spellcasting ability for these spells, and you don\'t need material components for them.',
        'Spells of the Mark: If you have the Spellcasting or Pact Magic class feature, the spells on the Mark of Warding Spells table are added to the spell list of your spellcasting class.',
    ],
    imageUrl: 'assets/images/races/mark_of_warding_dwarf.png',
    visual: {
        id: 'mark_of_warding_dwarf',
        icon: '🛡️',
        color: '#4169E1',
        maleIllustrationPath: 'assets/images/races/mark_of_warding_dwarf_male.png',
        femaleIllustrationPath: 'assets/images/races/mark_of_warding_dwarf_female.png',
    },
};
