/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/systems/naval/VoyageManager.ts
 * Logic for managing sea voyages, including daily progression and event resolution.
 */

import { Ship, VoyageState, VoyageEvent } from '../../types/naval';
import { VOYAGE_EVENTS } from '../../data/naval/voyageEvents';
import { CrewManager } from './CrewManager';
import { SeededRandom } from '../../utils/seededRandom';

export class VoyageManager {
    /**
     * Initializes a new voyage state.
     */
    static startVoyage(ship: Ship, distanceToDestination: number, seed?: number): VoyageState {
        return {
            shipId: ship.id,
            status: 'Sailing',
            daysAtSea: 0,
            distanceTraveled: 0,
            distanceToDestination,
            currentWeather: 'Calm',
            seed: seed || Date.now(),
            suppliesConsumed: { food: 0, water: 0 },
            log: [{
                day: 0,
                event: 'Voyage started.',
                type: 'Info'
            }]
        };
    }

    /**
     * Advances the voyage by one day.
     * 1. Updates distance based on speed.
     * 2. Consumes supplies.
     * 3. Triggers random event.
     * 4. Updates crew (daily wage/morale).
     */
    static advanceDay(state: VoyageState, ship: Ship, availableFunds: number = 1000): {
        newState: VoyageState;
        updatedShip: Ship;
        remainingFunds: number;
    } {
        if (state.distanceToDestination <= 0) {
            // Already arrived, just return
             return { newState: state, updatedShip: ship, remainingFunds: availableFunds };
        }

        // Initialize RNG with current state seed + day to ensure determinism for this day
        // but variation across days.
        const rng = new SeededRandom(state.seed + state.daysAtSea);

        const day = state.daysAtSea + 1;
        let dailyLog = '';
        let dailyLogType: VoyageState['log'][0]['type'] = 'Info';

        // Deep clone the ship to prevent side effects on the input object
        let currentShip: Ship = structuredClone(ship);
        // Clone the state to prevent side effects
        let currentState: VoyageState = structuredClone(state);

        // 1. Calculate Base Movement
        // Speed is usually ft/round.
        // Formula: (Speed / 10) * 24
        const milesPerDay = (ship.stats.speed / 10) * 24;
        let actualDistance = milesPerDay;

        // 2. Event Trigger
        // Pick a random event
        const possibleEvents = VOYAGE_EVENTS.filter(e => !e.conditions || e.conditions(currentState));

        const eventRoll = rng.next();

        if (eventRoll < 0.4 && possibleEvents.length > 0) {
            const eventIndex = Math.floor(rng.next() * possibleEvents.length);
            const event = possibleEvents[eventIndex];

            // Check probability specific to event
            if (rng.next() < (event.probability * 3)) { // Multiplier to normalize low prob stats
                 const result = event.effect(currentState, currentShip, rng);
                 dailyLog = result.log;
                 dailyLogType = result.type;

                 // Apply distance modifier from event (e.g., delay or boost)
                 if (result.distanceModifier) {
                     actualDistance += result.distanceModifier;
                 }
            }
        }

        // Ensure we don't go backwards excessively unless explicitly intended.
        // If actualDistance is negative, it means we are pushed back.
        // But we must check against distanceTraveled (can't go negative total distance).
        let newDistanceTraveled = currentState.distanceTraveled + actualDistance;
        if (newDistanceTraveled < 0) {
             actualDistance = -currentState.distanceTraveled; // Clamp movement to 0 total
             newDistanceTraveled = 0;
        }

        let newDistanceToDestination = currentState.distanceToDestination - actualDistance;
        // If we drifted back, distance to destination increases.
        // If we move forward past 0, it becomes 0.
        if (newDistanceToDestination < 0) newDistanceToDestination = 0;


        // 3. Consume Supplies
        const crewCount = currentShip.crew.members.length;
        const foodNeeded = crewCount * 1;
        const waterNeeded = crewCount * 2;

        let foodAvailable = currentShip.cargo.supplies.food;
        let waterAvailable = currentShip.cargo.supplies.water;

        let foodConsumedTotal = currentState.suppliesConsumed.food;
        let waterConsumedTotal = currentState.suppliesConsumed.water;

        let starvationPenalty = 0;
        let dehydrationPenalty = 0;

        // Eat Food
        if (foodAvailable >= foodNeeded) {
            foodAvailable -= foodNeeded;
            foodConsumedTotal += foodNeeded;
        } else {
            // Partial consumption
            foodConsumedTotal += foodAvailable;
            foodAvailable = 0;
            starvationPenalty = 5; // Morale hit
            dailyLog += ' Out of food! Crew is starving.';
            dailyLogType = 'Warning';
        }

        // Drink Water
        if (waterAvailable >= waterNeeded) {
            waterAvailable -= waterNeeded;
            waterConsumedTotal += waterNeeded;
        } else {
             waterConsumedTotal += waterAvailable;
             waterAvailable = 0;
             dehydrationPenalty = 10; // Severe morale hit
             dailyLog += ' Out of water! Crew is dehydrated.';
             dailyLogType = 'Warning';
        }

        // Update Ship Cargo
        currentShip.cargo.supplies = {
            food: foodAvailable,
            water: waterAvailable
        };

        // 4. Crew Updates
        // Apply starvation penalties before update
        if (starvationPenalty > 0 || dehydrationPenalty > 0) {
            CrewManager.modifyCrewMorale(currentShip.crew, -(starvationPenalty + dehydrationPenalty), 'Starvation/Dehydration');
        }

        const crewUpdate = CrewManager.processDailyCrewUpdate(currentShip, availableFunds);
        const finalShip = crewUpdate.ship;
        const funds = crewUpdate.remainingFunds;

        // 5. Finalize Log
        if (!dailyLog) {
            dailyLog = `Day ${day}: Sailed ${Math.round(actualDistance)} miles. Calm seas.`;
        } else if (!dailyLog.startsWith('Day')) {
            dailyLog = `Day ${day}: ${dailyLog} (Sailed ${Math.round(actualDistance)} miles)`;
        }

        let newStatus = currentState.status;
        if (newDistanceToDestination <= 0) {
            dailyLog += ' Land ho! Destination reached.';
            newStatus = 'Docked';
        }

        // Add Crew Logs
        crewUpdate.logs.forEach(l => {
             // Don't clutter unless critical?
             if (l.includes('MUTINY') || l.includes('CRITICAL')) {
                 dailyLog += ` [${l}]`;
                 dailyLogType = 'Warning';
             }
        });

        const newState: VoyageState = {
            ...currentState,
            daysAtSea: day,
            distanceTraveled: newDistanceTraveled,
            distanceToDestination: newDistanceToDestination,
            status: newStatus,
            suppliesConsumed: {
                food: foodConsumedTotal,
                water: waterConsumedTotal
            },
            log: [
                ...currentState.log,
                {
                    day,
                    event: dailyLog,
                    type: dailyLogType
                }
            ]
        };

        return {
            newState,
            updatedShip: finalShip,
            remainingFunds: funds
        };
    }
}
