/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/data/navalManeuvers.ts
 * Standard maneuvers available in naval combat.
 */

import { NavalManeuver } from '../types/navalCombat';

export const NAVAL_MANEUVERS: Record<string, NavalManeuver> = {
    FULL_SAIL: {
        id: 'FULL_SAIL',
        name: 'Full Sail',
        type: 'Movement',
        description: 'Maximize speed at the cost of maneuverability.',
        requirements: {
            minCrew: 5,
        },
        cooldown: 0,
        difficulty: 10,
        successEffect: 'Speed increased by 50% for 1 round. Maneuverability -2.',
        failureEffect: 'No speed increase. Sails may be damaged.',
    },
    EVASIVE_MANEUVERS: {
        id: 'EVASIVE_MANEUVERS',
        name: 'Evasive Maneuvers',
        type: 'Defensive',
        description: 'Zig-zag to avoid incoming fire.',
        requirements: {
            requiredRole: 'Captain',
            minCrew: 3,
        },
        cooldown: 1,
        difficulty: 15,
        successEffect: 'AC +4 for 1 round. Speed reduced by 25%.',
        failureEffect: 'No AC bonus. Speed reduced by 50%.',
    },
    BROADSIDE: {
        id: 'BROADSIDE',
        name: 'Broadside Volley',
        type: 'Offensive',
        description: 'Fire all cannons on one side.',
        requirements: {
            range: ['Short', 'Medium'],
            ammoType: 'Cannonball',
            ammoCost: 10, // Abstract quantity
        },
        cooldown: 1,
        difficulty: 12,
        successEffect: 'Deals heavy damage to target ship.',
        failureEffect: 'Missed or glancing blow.',
    },
    RAMMING_SPEED: {
        id: 'RAMMING_SPEED',
        name: 'Ramming Speed',
        type: 'Offensive',
        description: 'Collision course to damage enemy hull.',
        requirements: {
            range: ['Short'],
            minCrew: 10,
        },
        cooldown: 3,
        difficulty: 18,
        successEffect: 'Massive damage to both ships. Target may be stunned.',
        failureEffect: 'Missed target. Self damage taken from stress.',
    },
    BOARDING_PARTY: {
        id: 'BOARDING_PARTY',
        name: 'Boarding Party',
        type: 'Special',
        description: 'Launch grappling hooks and send crew to fight.',
        requirements: {
            range: ['Boarding', 'Short'],
            ammoType: 'Grapple',
            ammoCost: 1,
        },
        cooldown: 0,
        difficulty: 14,
        successEffect: 'Ships become Grappled. Crew combat begins.',
        failureEffect: 'Grapples failed to connect.',
    },
    REPAIR: {
        id: 'REPAIR',
        name: 'Emergency Repairs',
        type: 'Defensive',
        description: 'Crew scrambles to patch leaks.',
        requirements: {
            minCrew: 5,
            requiredRole: 'Bosun'
        },
        cooldown: 2,
        difficulty: 12,
        successEffect: 'Restore small amount of Hull Points.',
        failureEffect: 'Repairs failed.',
    }
};
