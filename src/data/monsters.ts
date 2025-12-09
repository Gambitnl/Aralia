/**
 * @file src/data/monsters.ts
 * Defines the base data for monsters that can be used in combat encounters.
 */
import { MonsterData } from '../types';
import { CharacterStats, Ability } from '../types/combat';
import { CLASSES_DATA } from './classes';

const GOBLIN_ABILITIES: Ability[] = [
    { id: 'scimitar', name: 'Scimitar', description: 'A slash with a rusty scimitar.', type: 'attack', cost: { type: 'action' }, targeting: 'single_enemy', range: 1, effects: [{ type: 'damage', value: 4, damageType: 'physical' }], icon: '🗡️' },
    { id: 'shortbow', name: 'Shortbow', description: 'Fires a crude arrow.', type: 'attack', cost: { type: 'action' }, targeting: 'single_enemy', range: 10, effects: [{ type: 'damage', value: 3, damageType: 'physical' }], icon: '🏹' },
];

const GOBLIN_STATS: Omit<CharacterStats, 'cr'> = {
    strength: 8,
    dexterity: 14,
    constitution: 10,
    intelligence: 10,
    wisdom: 8,
    charisma: 8,
    baseInitiative: 2,
    speed: 30,
};

const ORC_ABILITIES: Ability[] = [
    { id: 'greataxe', name: 'Greataxe', description: 'A furious swing with a heavy greataxe.', type: 'attack', cost: { type: 'action' }, targeting: 'single_enemy', range: 1, effects: [{ type: 'damage', value: 9, damageType: 'physical' }], icon: '🪓' },
    { id: 'javelin', name: 'Javelin', description: 'Hurls a javelin.', type: 'attack', cost: { type: 'action' }, targeting: 'single_enemy', range: 6, effects: [{ type: 'damage', value: 6, damageType: 'physical' }], icon: '🎯' },
];

const ORC_STATS: Omit<CharacterStats, 'cr'> = {
    strength: 16,
    dexterity: 12,
    constitution: 16,
    intelligence: 7,
    wisdom: 11,
    charisma: 10,
    baseInitiative: 1,
    speed: 30,
};

export const MONSTERS_DATA: Record<string, MonsterData> = {
    'goblin': {
        id: 'goblin',
        name: 'Goblin',
        baseStats: { ...GOBLIN_STATS, cr: '1/4', creatureTypes: ['Humanoid', 'Goblinoid'] },
        maxHP: 7,
        abilities: GOBLIN_ABILITIES,
        tags: ['goblinoid', 'forest', 'cave', 'hills', 'ruins'],
    },
    'orc': {
        id: 'orc',
        name: 'Orc',
        baseStats: { ...ORC_STATS, cr: '1/2', creatureTypes: ['Humanoid', 'Orc'] },
        maxHP: 15,
        abilities: ORC_ABILITIES,
        tags: ['goblinoid', 'forest', 'hills', 'mountain', 'cave'],
    },
    'bugbear': {
        id: 'bugbear',
        name: 'Bugbear',

        baseStats: { ...ORC_STATS, strength: 17, cr: '1' },
        maxHP: 27,
        abilities: [
            { id: 'morningstar', name: 'Morningstar', description: 'A brutal swing with a spiked morningstar.', type: 'attack', cost: { type: 'action' }, targeting: 'single_enemy', range: 1, effects: [{ type: 'damage', value: 11, damageType: 'physical' }], icon: '⭐' },
            { id: 'javelin_bugbear', name: 'Javelin', description: 'Hurls a javelin.', type: 'attack', cost: { type: 'action' }, targeting: 'single_enemy', range: 6, effects: [{ type: 'damage', value: 9, damageType: 'physical' }], icon: '🎯' },
        ],
        tags: ['goblinoid', 'forest', 'cave'],
    }
    // Add more monsters here
};