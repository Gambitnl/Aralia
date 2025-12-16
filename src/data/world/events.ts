/**
 * @file src/data/world/events.ts
 * Initial seed data for world events.
 */
import { WorldEvent } from '../../types/economy';

export const INITIAL_WORLD_EVENTS: WorldEvent[] = [
    {
        id: 'evt_seed_war_north',
        type: 'WAR',
        name: 'Northern Border Conflict',
        description: 'Tensions flare on the northern border, driving up the cost of steel and weapons.',
        affectedLocations: ['tundra', 'mountains'],
        affectedItemCategories: ['weapon', 'armor'],
        priceModifier: 1.4,
        duration: 30,
        startTime: 0
    },
    {
        id: 'evt_seed_plague_swamp',
        type: 'PLAGUE',
        name: 'Swamp Fever',
        description: 'A sickness spreads near the swamps, making medicinal herbs scarce.',
        affectedLocations: ['swamp'],
        affectedItemCategories: ['potion', 'ingredient'],
        priceModifier: 1.8,
        duration: 14,
        startTime: 0
    }
];
