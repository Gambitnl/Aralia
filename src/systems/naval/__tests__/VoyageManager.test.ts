import { describe, it, expect } from 'vitest';
import { VoyageManager } from '../VoyageManager';
import { CrewMember, Ship } from '../../../types/naval';
import { CrewManager } from '../CrewManager';
import { WeatherState } from '../../../types/environment';
import { SeededRandom } from '../../../utils/random';

/**
 * ARCHITECTURAL CONTEXT:
 * This test suite validates the 'Voyage Engine' (VoyageManager). It 
 * simulates days at sea, supply consumption, and crew morale changes 
 * during naval travel.
 *
 * Recent updates focus on deterministic simulation. These tests pass an
 * explicit seeded source so voyage events, crew updates, and supply changes
 * stay replay-stable instead of depending on process-global randomness.
 * 
 * @file src/systems/naval/__tests__/VoyageManager.test.ts
 */

describe('VoyageManager', () => {
    const noEventRng = {
        next: () => 0.99,
        nextInt: (min: number) => min,
        pick: <T>(values: T[]) => values[0],
    } as SeededRandom;

    // Mock Ship
    const createMockShip = (): Ship => {
        const baseStats: Ship['stats'] = {
            speed: 40, // 40ft/round -> 4 mph -> 96 miles/day
            maneuverability: 2,
            hullPoints: 100,
            maxHullPoints: 100,
            armorClass: 14,
            cargoCapacity: 50,
            crewMin: 5,
            crewMax: 20
        };
        const baseCargo: Ship['cargo'] = {
            items: [],
            totalWeight: 0,
            capacityUsed: 0,
            supplies: { food: 100, water: 200 }
        };
        const baseCrewMembers: CrewMember[] = [
            {
                id: 'crew-captain',
                name: 'Ada Tide',
                role: 'Captain',
                skills: { navigation: 5, leadership: 4 },
                morale: 80,
                loyalty: 50,
                dailyWage: 10,
                traits: ['Loyal']
            },
            {
                id: 'crew-sailor',
                name: 'Borin Wake',
                role: 'Sailor',
                skills: { navigation: 2, seamanship: 3 },
                morale: 78,
                loyalty: 48,
                dailyWage: 2,
                traits: []
            }
        ];

        return ({
        id: 'ship-1',
        name: 'The Sea Spray',
        type: 'Sloop',
        size: 'Small',
        description: 'A fast sloop.',
        stats: baseStats,
        crew: CrewManager.calculateCrewStats(baseCrewMembers),
        cargo: baseCargo,
        modifications: [],
        weapons: [],
        flags: {}
    });
    };

    const mockWeather: WeatherState = {
        precipitation: 'none',
        temperature: 'temperate',
        wind: { direction: 'north', speed: 'moderate' },
        visibility: 'clear'
    };

    it('should initialize a voyage correctly', () => {
        const ship = createMockShip();
        const voyage = VoyageManager.startVoyage(ship, 500);
        expect(voyage.status).toBe('Sailing');
        expect(voyage.daysAtSea).toBe(0);
        expect(voyage.distanceToDestination).toBe(500);
    });

    it('should advance the day and move the ship', () => {
        const ship = createMockShip();
        let voyage = VoyageManager.startVoyage(ship, 500);
        const result = VoyageManager.advanceDay(voyage, ship, mockWeather, 1000, noEventRng);

        voyage = result.newState;

        expect(voyage.daysAtSea).toBe(1);
        // Speed 40 -> 96 miles/day.
        expect(voyage.distanceTraveled).toBeGreaterThanOrEqual(96);
        expect(voyage.log.length).toBeGreaterThan(1); // Init log + Day 1 log
    });

    it('should consume supplies from ship cargo', () => {
        const ship = createMockShip();
        const voyage = VoyageManager.startVoyage(ship, 500);
        const crewCount = ship.crew.members.length;
        const initialFood = ship.cargo.supplies.food;
        const initialWater = ship.cargo.supplies.water;

        const result = VoyageManager.advanceDay(voyage, ship, mockWeather, 1000, noEventRng);
        const updatedShip = result.updatedShip;

        // 1 food per person, 2 water per person
        expect(updatedShip.cargo.supplies.food).toBe(initialFood - crewCount);
        expect(updatedShip.cargo.supplies.water).toBe(initialWater - (crewCount * 2));
    });

    it('should handle starvation when supplies run out', () => {
        const ship = createMockShip();
        // Set low supplies
        ship.cargo.supplies.food = 0;
        ship.cargo.supplies.water = 0;
        // Crew traits can raise or lower the generated starting morale, so the
        // starvation check compares against the actual crew state instead of a
        // fixed baseline that only applies to trait-neutral crew.
        const startingMorale = ship.crew.averageMorale;
        const voyage = VoyageManager.startVoyage(ship, 500);
        const result = VoyageManager.advanceDay(voyage, ship, mockWeather, 1000, noEventRng);
        const updatedShip = result.updatedShip;

        // Check logs for warning
        const lastLog = result.newState.log[result.newState.log.length - 1];
        expect(lastLog.event).toContain('suffering from starvation');
        expect(lastLog.type).toBe('Warning');

        // Check morale hit
        expect(updatedShip.crew.averageMorale).toBeLessThan(startingMorale);
    });

    it('should finish voyage when distance is reached', () => {
        const ship = createMockShip();
        const voyage = VoyageManager.startVoyage(ship, 50); // Short trip
        const result = VoyageManager.advanceDay(voyage, ship, mockWeather, 1000, noEventRng);

        expect(result.newState.status).toBe('Docked');
        expect(result.newState.log[result.newState.log.length - 1].event).toContain('Land ho');
    });

    it('should repeat the same voyage outcome for identical seeded inputs', () => {
        const firstShip = createMockShip();
        const secondShip = createMockShip();
        const firstVoyage = VoyageManager.startVoyage(firstShip, 500);
        const secondVoyage = VoyageManager.startVoyage(secondShip, 500);

        const first = VoyageManager.advanceDay(firstVoyage, firstShip, mockWeather, 1000, new SeededRandom(42));
        const second = VoyageManager.advanceDay(secondVoyage, secondShip, mockWeather, 1000, new SeededRandom(42));

        expect(first.newState).toEqual(second.newState);
        expect(first.updatedShip).toEqual(second.updatedShip);
        expect(first.remainingFunds).toBe(second.remainingFunds);
    });
});
