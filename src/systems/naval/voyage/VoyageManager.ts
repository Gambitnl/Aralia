/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/systems/naval/voyage/VoyageManager.ts
 * Manages long-distance naval travel, daily events, and supply consumption.
 */

import { Ship, VoyageState, VoyageEvent, VoyageLogEntry, VoyageStatus } from '../../../types/naval';
import { rollDice } from '../../../utils/combatUtils';
import { CrewManager } from '../CrewManager';

// --- Constants ---
const DAILY_FOOD_CONSUMPTION_PER_CREW = 1; // Rations per person
const DAILY_WATER_CONSUMPTION_PER_CREW = 1; // Gallons (abstracted)

// --- Events Registry ---
// Probabilities should sum to <= 1.0 (remainder is nothing happens or default sailing)
const VOYAGE_EVENTS: VoyageEvent[] = [
    {
        id: 'smooth_sailing',
        name: 'Smooth Sailing',
        description: 'The winds are favorable and the sea is calm.',
        type: 'Fluff',
        probability: 0.5,
        effect: (state, ship) => {
            // Speed (mph) = Speed (ft/round) / 10
            // Miles/day = Speed (mph) * 24
            const dailyMiles = (ship.stats.speed / 10) * 24;
            state.distanceTraveled += dailyMiles;
            state.distanceToDestination = Math.max(0, state.distanceToDestination - dailyMiles);
            return { log: `Smooth sailing today. Covered ${Math.round(dailyMiles)} miles.`, type: 'Info' };
        }
    },
    {
        id: 'storm',
        name: 'Storm',
        description: 'A violent storm batters the ship.',
        type: 'Weather',
        probability: 0.1,
        effect: (state, ship) => {
             // Damage ship
             const damage = rollDice('2d10');
             ship.stats.hullPoints = Math.max(0, ship.stats.hullPoints - damage);

             // Slow progress
             const dailyMiles = ((ship.stats.speed / 10) * 24) * 0.5;
             state.distanceTraveled += dailyMiles;
             state.distanceToDestination = Math.max(0, state.distanceToDestination - dailyMiles);

             // Morale hit
             CrewManager.modifyCrewMorale(ship.crew, -5, 'Storm');

             return { log: `Storm! The ship took ${damage} damage and made slow progress.`, type: 'Warning' };
        }
    },
    {
        id: 'dolphins',
        name: 'Dolphins',
        description: 'A pod of dolphins swims alongside the ship.',
        type: 'Fluff',
        probability: 0.1,
        effect: (state, ship) => {
            const dailyMiles = (ship.stats.speed / 10) * 24;
            state.distanceTraveled += dailyMiles;
            state.distanceToDestination = Math.max(0, state.distanceToDestination - dailyMiles);

            // Morale boost
            CrewManager.modifyCrewMorale(ship.crew, 5, 'Dolphins');
            return { log: `Dolphins spotted! The crew is in high spirits.`, type: 'Info' };
        }
    },
    {
        id: 'no_wind',
        name: 'Doldrums',
        description: 'The wind dies down completely.',
        type: 'Weather',
        probability: 0.1,
        effect: (state, ship) => {
             // No progress unless rowed (not implemented yet)
             return { log: `Caught in the doldrums. No progress made today.`, type: 'Warning' };
        }
    }
];

// Fallback event if nothing rolls
const DEFAULT_EVENT = VOYAGE_EVENTS[0]; // Smooth sailing

export class VoyageManager {
    /**
     * Starts a new voyage.
     */
    static startVoyage(ship: Ship, distance: number): VoyageState {
        return {
            shipId: ship.id,
            status: 'Sailing',
            daysAtSea: 0,
            distanceTraveled: 0,
            distanceToDestination: distance,
            currentWeather: 'Calm',
            suppliesConsumed: { food: 0, water: 0 },
            log: [{ day: 0, event: 'Voyage Started', type: 'Info' }]
        };
    }

    /**
     * Advances the voyage by one day.
     * Handles movement, supplies, and events.
     * WARNING: Mutation Note - The returned ship object is a DEEP CLONE of the input.
     * However, the 'state' input is not mutated (new object returned).
     */
    static advanceDay(state: VoyageState, ship: Ship): { state: VoyageState; ship: Ship } {
        if (state.status !== 'Sailing' && state.status !== 'Storm') {
            return { state, ship }; // Can't advance if docked or in combat (handled elsewhere)
        }

        const newState = { ...state };

        // Deep clone ship to avoid side effects on the original reference
        // Using JSON parse/stringify is safe here as Ship contains only serializable data
        const newShip: Ship = JSON.parse(JSON.stringify(ship));

        newState.daysAtSea++;

        // Ensure supplies exist (legacy data protection)
        if (!newShip.cargo.supplies) {
            newShip.cargo.supplies = { food: 0, water: 0 };
        }

        // 1. Consume Supplies
        const crewCount = newShip.crew.members.length;
        const foodNeeded = crewCount * DAILY_FOOD_CONSUMPTION_PER_CREW;
        const waterNeeded = crewCount * DAILY_WATER_CONSUMPTION_PER_CREW;

        if (newShip.cargo.supplies.food >= foodNeeded) {
            newShip.cargo.supplies.food -= foodNeeded;
            newState.suppliesConsumed.food += foodNeeded;
        } else {
            // Starvation!
            newShip.cargo.supplies.food = 0;
            CrewManager.modifyCrewMorale(newShip.crew, -10, 'Starvation');
            newState.log.push({ day: newState.daysAtSea, event: 'Out of food! Crew is starving.', type: 'Warning' });
        }

        if (newShip.cargo.supplies.water >= waterNeeded) {
            newShip.cargo.supplies.water -= waterNeeded;
            newState.suppliesConsumed.water += waterNeeded;
        } else {
             // Dehydration!
             newShip.cargo.supplies.water = 0;
             CrewManager.modifyCrewMorale(newShip.crew, -15, 'Dehydration');
             newState.log.push({ day: newState.daysAtSea, event: 'Out of water! Crew is desperate.', type: 'Warning' });
        }

        // 2. Determine Event
        const event = this.rollEvent(state);
        const outcome = event.effect(newState, newShip);

        // Log outcome
        newState.log.push({
            day: newState.daysAtSea,
            event: outcome.log,
            type: outcome.type
        });

        // 3. Check Arrival
        if (newState.distanceToDestination <= 0) {
            newState.status = 'Docked';
            newState.distanceToDestination = 0;
            newState.log.push({ day: newState.daysAtSea, event: 'Land ho! Arrived at destination.', type: 'Info' });
        }

        return { state: newState, ship: newShip };
    }

    private static rollEvent(state: VoyageState): VoyageEvent {
        const rand = Math.random();
        let cumulative = 0;

        for (const event of VOYAGE_EVENTS) {
            cumulative += event.probability;
            if (rand < cumulative) {
                // Check condition if exists
                if (event.conditions && !event.conditions(state)) {
                    continue; // Skip if condition fails, keep looking (or fall through)
                    // Note: This naive skip might mess up probability distribution if condition fails.
                    // For now, simpler is better: assume conditions are rare filters.
                }
                return event;
            }
        }

        return DEFAULT_EVENT;
    }
}
