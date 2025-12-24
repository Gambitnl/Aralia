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

export class VoyageManager {
    /**
     * Initializes a new voyage state.
     */
    static startVoyage(ship: Ship, distanceToDestination: number): VoyageState {
        return {
            shipId: ship.id,
            status: 'Sailing',
            daysAtSea: 0,
            distanceTraveled: 0,
            distanceToDestination,
            currentWeather: 'Calm',
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
     * 2. Consumes supplies from ship cargo.
     * 3. Triggers random event.
     * 4. Updates crew (daily wage/morale).
     */
    static advanceDay(state: VoyageState, ship: Ship, availableFunds: number = 1000): {
        newState: VoyageState;
        updatedShip: Ship;
        remainingFunds: number;
    } {
        if (state.distanceTraveled >= state.distanceToDestination) {
            // Already arrived, just return
             return { newState: state, updatedShip: ship, remainingFunds: availableFunds };
        }

        const day = state.daysAtSea + 1;
        let dailyLog = '';
        let dailyLogType: VoyageState['log'][0]['type'] = 'Info';

        // Clone ship to avoid mutation side effects
        let workingShip = JSON.parse(JSON.stringify(ship)) as Ship;

        // 1. Calculate Base Movement
        // Speed is usually ft/round.
        // Formula: (Speed / 10) * 24 = miles/day approx
        const milesPerDay = (workingShip.stats.speed / 10) * 24;
        let actualDistance = milesPerDay;

        // 2. Event Trigger
        const possibleEvents = VOYAGE_EVENTS.filter(e => !e.conditions || e.conditions(state));

        // 30% chance of event per day
        const eventRoll = Math.random();

        if (eventRoll < 0.3 && possibleEvents.length > 0) {
            const eventIndex = Math.floor(Math.random() * possibleEvents.length);
            const event = possibleEvents[eventIndex];

            // Check probability specific to event (normalized by factor of 3 to account for 30% base chance)
            if (Math.random() < (event.probability * 3)) {
                 const result = event.effect(state, workingShip);
                 dailyLog = result.log;
                 dailyLogType = result.type;
            }
        }

        state.distanceTraveled += actualDistance;
        state.distanceToDestination = Math.max(0, state.distanceToDestination - actualDistance);

        // 3. Crew Updates
        const crewUpdate = CrewManager.processDailyCrewUpdate(workingShip, availableFunds);
        workingShip = crewUpdate.ship;
        const funds = crewUpdate.remainingFunds;

        // 4. Consume Supplies
        const crewCount = workingShip.crew.members.length;
        const foodConsumed = crewCount * 1; // 1 ration per person
        const waterConsumed = crewCount * 2; // 2 gallons?

        // Apply consumption to stats tracking
        state.suppliesConsumed.food += foodConsumed;
        state.suppliesConsumed.water += waterConsumed;

        // Apply consumption to actual ship stores
        if (workingShip.cargo.supplies.food >= foodConsumed) {
            workingShip.cargo.supplies.food -= foodConsumed;
        } else {
            workingShip.cargo.supplies.food = 0;
            // Starvation Logic
            CrewManager.modifyCrewMorale(workingShip.crew, -5, 'Starvation');
            if (!dailyLog) dailyLog = 'The crew goes hungry.';
            else dailyLog += ' Also, we have run out of food!';
            dailyLogType = 'Warning';
        }

        if (workingShip.cargo.supplies.water >= waterConsumed) {
            workingShip.cargo.supplies.water -= waterConsumed;
        } else {
            workingShip.cargo.supplies.water = 0;
            // Dehydration Logic - more severe
            CrewManager.modifyCrewMorale(workingShip.crew, -10, 'Dehydration');
            if (!dailyLog.includes('food')) {
                 if (!dailyLog) dailyLog = 'The water barrels are dry!';
                 else dailyLog += ' Also, we have run out of water!';
                 dailyLogType = 'Warning';
            }
        }

        // 5. Finalize Log
        if (!dailyLog) {
            dailyLog = `Day ${day}: Sailed ${Math.round(actualDistance)} miles. Calm seas.`;
        } else if (!dailyLog.includes('Day')) {
             // Prepend day if not present (some events might overwrite)
             dailyLog = `Day ${day}: ${dailyLog} (Sailed ${Math.round(actualDistance)} miles)`;
        }

        if (state.distanceTraveled >= state.distanceToDestination) {
            dailyLog += ' Land ho! Destination reached.';
            state.status = 'Docked';
        }

        // Add Crew Logs
        crewUpdate.logs.forEach(l => {
             if (l.includes('MUTINY') || l.includes('CRITICAL')) {
                 dailyLog += ` [${l}]`;
                 dailyLogType = 'Warning';
             }
        });

        const newState: VoyageState = {
            ...state,
            daysAtSea: day,
            log: [
                ...state.log,
                {
                    day,
                    event: dailyLog,
                    type: dailyLogType
                }
            ]
        };

        return {
            newState,
            updatedShip: workingShip,
            remainingFunds: funds
        };
    }
}
