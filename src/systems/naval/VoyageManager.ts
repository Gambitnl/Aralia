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
        // Clone ship to avoid mutating input directly
        let currentShip = JSON.parse(JSON.stringify(ship)) as Ship;

        if (state.distanceToDestination <= 0) {
            // Already arrived, just return
             return { newState: state, updatedShip: currentShip, remainingFunds: availableFunds };
        }

        const day = state.daysAtSea + 1;
        let dailyLog = '';
        let dailyLogType: VoyageState['log'][0]['type'] = 'Info';

        // 1. Calculate Base Movement
        const milesPerDay = (currentShip.stats.speed / 10) * 24;
        let actualDistance = milesPerDay;

        // 2. Event Trigger
        const possibleEvents = VOYAGE_EVENTS.filter(e => !e.conditions || e.conditions(state));

        // Simple weighted choice
        const eventRoll = Math.random();
        let eventResult = null;

        if (eventRoll < 0.4 && possibleEvents.length > 0) {
            const eventIndex = Math.floor(Math.random() * possibleEvents.length);
            const event = possibleEvents[eventIndex];

            if (Math.random() < (event.probability * 3)) {
                 const result = event.effect(state, currentShip);
                 dailyLog = result.log;
                 dailyLogType = result.type;
                 eventResult = event;
            }
        }

        // Update state distance
        state.distanceTraveled += actualDistance;
        state.distanceToDestination = Math.max(0, state.distanceToDestination - actualDistance);

        // 3. Crew Updates
        const crewUpdate = CrewManager.processDailyCrewUpdate(currentShip, availableFunds);
        currentShip = crewUpdate.ship;
        const funds = crewUpdate.remainingFunds;

        // 4. Consume Supplies
        const crewCount = currentShip.crew.members.length;
        const foodNeeded = crewCount * 1;
        const waterNeeded = crewCount * 2;

        let starving = false;
        let thirsty = false;

        // Deduct Food
        if (currentShip.cargo.supplies.food >= foodNeeded) {
            currentShip.cargo.supplies.food -= foodNeeded;
            state.suppliesConsumed.food += foodNeeded;
        } else {
            // Consume remainder
            state.suppliesConsumed.food += currentShip.cargo.supplies.food;
            currentShip.cargo.supplies.food = 0;
            starving = true;
        }

        // Deduct Water
        if (currentShip.cargo.supplies.water >= waterNeeded) {
            currentShip.cargo.supplies.water -= waterNeeded;
            state.suppliesConsumed.water += waterNeeded;
        } else {
             state.suppliesConsumed.water += currentShip.cargo.supplies.water;
             currentShip.cargo.supplies.water = 0;
             thirsty = true;
        }

        // Starvation/Thirst Consequences
        if (starving || thirsty) {
            const reason = starving && thirsty ? 'Starvation & Thirst' : (starving ? 'Starvation' : 'Thirst');
            CrewManager.modifyCrewMorale(currentShip.crew, -10, reason);
            dailyLog += ` CRITICAL: Crew is suffering from ${reason.toLowerCase()}!`;
            dailyLogType = 'Warning';

            // Recalculate crew stats after modification
            currentShip.crew = CrewManager.calculateCrewStats(currentShip.crew.members);
        }

        // 5. Finalize Log
        if (!dailyLog) {
            dailyLog = `Day ${day}: Sailed ${Math.round(actualDistance)} miles. Calm seas.`;
        } else if (!dailyLog.includes('Day')) {
            dailyLog = `Day ${day}: ${dailyLog} (Sailed ${Math.round(actualDistance)} miles)`;
        }

        if (state.distanceToDestination <= 0) {
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
            updatedShip: currentShip,
            remainingFunds: funds
        };
    }
}
