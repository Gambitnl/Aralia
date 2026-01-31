/**
 * Copyright (c) 2024 Aralia RPG.
 * Licensed under the MIT License.
 *
 * @file src/systems/naval/VoyageManager.ts
 * Logic for managing sea voyages, including daily progression and event resolution.
 */
// TODO(lint-intent): 'VoyageEvent' is imported but unused; it hints at a helper/type the module was meant to use.
// TODO(lint-intent): If the planned feature is still relevant, wire it into the data flow or typing in this file.
// TODO(lint-intent): Otherwise drop the import to keep the module surface intentional.
import { Ship, VoyageState, VoyageEvent as _VoyageEvent, RationingLevel } from '../../types/naval';
import { VOYAGE_EVENTS } from '../../data/naval/voyageEvents';
import { CrewManager } from './CrewManager';
import { WeatherState } from '../../types/environment';

export class VoyageManager {
    /**
     * Initializes a new voyage state.
     */
    static startVoyage(ship: Ship, distanceToDestination: number): VoyageState {
        return {
            shipId: ship.id,
            status: 'Sailing',
            rationingLevel: 'normal',
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
     * 1. Updates distance based on speed and weather.
     * 2. Consumes supplies from ship cargo based on rationing.
     * 3. Triggers random event.
     * 4. Updates crew (daily wage/morale).
     */
    static advanceDay(
        state: VoyageState, 
        ship: Ship, 
        weather: WeatherState,
        availableFunds: number = 1000
    ): {
        newState: VoyageState;
        updatedShip: Ship;
        remainingFunds: number;
    } {
        // RALPH: The Voyage Heartbeat.
        // Runs every 24 in-game hours while at sea.
        // Calculates progress, processes the "Supply Tax" (Food/Water), and rolls for random encounters.
        
        // Clone ship to avoid mutating input directly
        let currentShip = JSON.parse(JSON.stringify(ship)) as Ship;

        if (state.distanceToDestination <= 0) {
            // Already arrived, just return
             return { newState: state, updatedShip: currentShip, remainingFunds: availableFunds };
        }

        const day = state.daysAtSea + 1;
        let dailyLog = '';
        let dailyLogType: VoyageState['log'][0]['type'] = 'Info';

        // 1. Calculate Base Movement with Weather Modifiers
        // RALPH: Nautical Math. Speed / 10 = Knots (roughly). * 24h = Daily Range.
        const baseMilesPerDay = (currentShip.stats.speed / 10) * 24;
        let weatherModifier = 1.0;

        // RALPH: Deterministic movement.
        // Wind speed directly affects progress. Storms force anchors or slow progress.
        if (weather.wind.speed === 'strong' || weather.wind.speed === 'gale') {
            weatherModifier *= 1.25; // Good winds boost speed
        } else if (weather.wind.speed === 'calm') {
            weatherModifier *= 0.75; // Lack of wind slows sailing ships
        }

        if (weather.precipitation === 'storm' || weather.precipitation === 'blizzard') {
            weatherModifier *= 0.5; // Heavy storms are dangerous and slow
        }

        const actualDistance = baseMilesPerDay * weatherModifier;

        // 2. Event Trigger
        // RALPH: Chaos Factor. 40% chance of a random event (Storm, Kraken, Ghost Ship).
        const possibleEvents = VOYAGE_EVENTS.filter(e => !e.conditions || e.conditions(state));

        // Simple weighted choice
        const eventRoll = Math.random();
        let _eventResult = null;

        if (eventRoll < 0.4 && possibleEvents.length > 0) {
            const eventIndex = Math.floor(Math.random() * possibleEvents.length);
            const event = possibleEvents[eventIndex];

            if (Math.random() < (event.probability * 3)) {
                 const result = event.effect(state, currentShip);
                 dailyLog = result.log;
                 dailyLogType = result.type;
                 // TODO(lint-intent): '_eventResult' is declared but unused, suggesting an unfinished state/behavior hook in this block.
                 // TODO(lint-intent): If the intent is still active, connect it to the nearby render/dispatch/condition so it matters.
                 // TODO(lint-intent): Otherwise remove it or prefix with an underscore to record intentional unused state.
                 _eventResult = event;
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
        // RALPH: Survival Mechanics. Crew consumes 1 Food / 2 Water per day base.
        // Rationing Level affects consumption and Morale.
        const crewCount = currentShip.crew.members.length;
        const rationing = state.rationingLevel || 'normal';
        
        let foodMultiplier = 1.0;
        let waterMultiplier = 1.0;
        let moralePenalty = 0;

        if (rationing === 'half') {
            foodMultiplier = 0.5;
            moralePenalty = -5;
            dailyLog += ' Crew is on half-rations.';
        } else if (rationing === 'starvation') {
            foodMultiplier = 0;
            waterMultiplier = 0.5;
            moralePenalty = -15;
            dailyLog += ' Crew is starving!';
        }

        const foodNeeded = crewCount * 1 * foodMultiplier;
        const waterNeeded = crewCount * 2 * waterMultiplier;

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

        // Apply morale penalty from rationing OR scarcity
        if (moralePenalty < 0) {
            CrewManager.modifyCrewMorale(currentShip.crew, moralePenalty, 'rationing');
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
