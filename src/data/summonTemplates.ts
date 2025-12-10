import { z } from 'zod';
import { SummonedEntityStatBlock } from '../systems/spells/validation/spellValidator';

/**
 * Defines the structure for a summoned entity's stat block.
 * Inferred from the Zod schema to ensure consistency.
 */
export type SummonTemplate = z.infer<typeof SummonedEntityStatBlock>;

export const SUMMON_TEMPLATES: Record<string, SummonTemplate> = {
    // Familiars
    'Bat': {
        name: 'Bat',
        type: 'Beast',
        size: 'Tiny',
        ac: 12,
        hp: 1,
        speed: 5,
        flySpeed: 30,
        abilities: { str: 2, dex: 15, con: 8, int: 2, wis: 12, cha: 4 },
        senses: ['Blindsight 60 ft.'],
    },
    'Cat': {
        name: 'Cat',
        type: 'Beast',
        size: 'Tiny',
        ac: 12,
        hp: 2,
        speed: 40,
        climbSpeed: 30,
        abilities: { str: 3, dex: 15, con: 10, int: 3, wis: 12, cha: 7 },
        senses: ['Darkvision 60 ft.'],
    },
    'Crab': {
        name: 'Crab',
        type: 'Beast',
        size: 'Tiny',
        ac: 11,
        hp: 2,
        speed: 20,
        swimSpeed: 20,
        abilities: { str: 2, dex: 11, con: 10, int: 1, wis: 8, cha: 2 },
        senses: ['Blindsight 30 ft.'],
    },
    'Frog': { // Also Toad
        name: 'Frog',
        type: 'Beast',
        size: 'Tiny',
        ac: 11,
        hp: 1,
        speed: 20,
        swimSpeed: 20,
        abilities: { str: 1, dex: 13, con: 8, int: 1, wis: 8, cha: 3 },
        senses: ['Darkvision 30 ft.'],
    },
    'Hawk': {
        name: 'Hawk',
        type: 'Beast',
        size: 'Tiny',
        ac: 13,
        hp: 1,
        speed: 10,
        flySpeed: 60,
        abilities: { str: 5, dex: 16, con: 8, int: 2, wis: 14, cha: 6 },
        senses: ['Passive Perception 14'],
    },
    'Lizard': {
        name: 'Lizard',
        type: 'Beast',
        size: 'Tiny',
        ac: 10,
        hp: 2,
        speed: 20,
        climbSpeed: 20,
        abilities: { str: 2, dex: 11, con: 10, int: 1, wis: 8, cha: 3 },
        senses: ['Darkvision 30 ft.'],
    },
    'Octopus': {
        name: 'Octopus',
        type: 'Beast',
        size: 'Small',
        ac: 12,
        hp: 3,
        speed: 5,
        swimSpeed: 30,
        abilities: { str: 4, dex: 15, con: 11, int: 3, wis: 10, cha: 4 },
        senses: ['Darkvision 30 ft.'],
    },
    'Owl': {
        name: 'Owl',
        type: 'Beast',
        size: 'Tiny',
        ac: 11,
        hp: 1,
        speed: 5,
        flySpeed: 60,
        abilities: { str: 3, dex: 13, con: 8, int: 2, wis: 12, cha: 7 },
        senses: ['Darkvision 120 ft.'],
    },
    'Poisonous Snake': {
        name: 'Poisonous Snake',
        type: 'Beast',
        size: 'Tiny',
        ac: 13,
        hp: 2,
        speed: 30,
        swimSpeed: 30,
        abilities: { str: 2, dex: 16, con: 11, int: 1, wis: 10, cha: 3 },
        senses: ['Blindsight 10 ft.'],
    },
    'Quipper': { // Fish
        name: 'Quipper',
        type: 'Beast',
        size: 'Tiny',
        ac: 13,
        hp: 1,
        speed: 0,
        swimSpeed: 40,
        abilities: { str: 2, dex: 16, con: 9, int: 1, wis: 7, cha: 2 },
        senses: ['Darkvision 60 ft.'],
    },
    'Rat': {
        name: 'Rat',
        type: 'Beast',
        size: 'Tiny',
        ac: 10,
        hp: 1,
        speed: 20,
        abilities: { str: 2, dex: 11, con: 9, int: 2, wis: 10, cha: 4 },
        senses: ['Darkvision 30 ft.'],
    },
    'Raven': {
        name: 'Raven',
        type: 'Beast',
        size: 'Tiny',
        ac: 12,
        hp: 1,
        speed: 10,
        flySpeed: 50,
        abilities: { str: 2, dex: 14, con: 8, int: 2, wis: 12, cha: 6 },
        senses: ['Passive Perception 13'],
    },
    'Sea Horse': {
        name: 'Sea Horse',
        type: 'Beast',
        size: 'Tiny',
        ac: 11,
        hp: 1,
        speed: 0,
        swimSpeed: 20,
        abilities: { str: 1, dex: 12, con: 8, int: 1, wis: 10, cha: 2 },
        senses: ['Passive Perception 10'],
    },
    'Spider': {
        name: 'Spider',
        type: 'Beast',
        size: 'Tiny',
        ac: 12,
        hp: 1,
        speed: 20,
        climbSpeed: 20,
        abilities: { str: 2, dex: 14, con: 8, int: 1, wis: 10, cha: 2 },
        senses: ['Darkvision 30 ft.'],
    },
    'Weasel': {
        name: 'Weasel',
        type: 'Beast',
        size: 'Tiny',
        ac: 13,
        hp: 1,
        speed: 30,
        abilities: { str: 3, dex: 16, con: 8, int: 2, wis: 12, cha: 3 },
        senses: ['Passive Perception 13'],
    }
};

/**
 * Helper to get a template, handling case insensitivity and aliases.
 */
export function getSummonTemplate(name: string): SummonTemplate | undefined {
    // Direct match
    if (SUMMON_TEMPLATES[name]) return SUMMON_TEMPLATES[name];

    // Case insensitive match
    const lowerName = name.toLowerCase();
    const entry = Object.entries(SUMMON_TEMPLATES).find(([key]) => key.toLowerCase() === lowerName);
    if (entry) return entry[1];

    // Aliases
    if (lowerName === 'toad') return SUMMON_TEMPLATES['Frog'];
    if (lowerName === 'fish') return SUMMON_TEMPLATES['Quipper'];

    return undefined;
}
