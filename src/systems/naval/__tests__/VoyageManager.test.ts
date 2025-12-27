
import { describe, it, expect } from 'vitest';
import { VoyageManager } from '../VoyageManager';
import { Ship } from '../../../types/naval';
import { CrewManager } from '../CrewManager';

describe('VoyageManager', () => {
    // Mock Ship
    const createMockShip = (): Ship => ({
        id: 'ship-1',
        name: 'The Sea Spray',
        type: 'Sloop',
        size: 'Small',
        description: 'A fast sloop.',
        stats: {
            speed: 40, // 40ft/round -> 4 mph -> 96 miles/day
            maneuverability: 2,
            hullPoints: 100,
            maxHullPoints: 100,
            armorClass: 14,
            cargoCapacity: 50,
            crewMin: 5,
            crewMax: 20
        },
        crew: CrewManager.recruitCrew({
            id: 'mock',
            name: 'Mock',
            type: 'Sloop',
            size: 'Small',
            description: '',
            stats: {} as any,
            crew: { members: [], averageMorale: 80, unrest: 0, quality: 'Average' },
            cargo: {} as any,
            modifications: [],
            weapons: [],
            flags: {}
        }, 'Captain', 1).crew,
        cargo: { items: [], totalWeight: 0, capacityUsed: 0, supplies: { food: 100, water: 200 } },
        modifications: [],
        weapons: [],
        flags: {}
    });

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
        const result = VoyageManager.advanceDay(voyage, ship, 1000);

        voyage = result.newState;

        expect(voyage.daysAtSea).toBe(1);
        // Speed 40 -> 96 miles/day.
        expect(voyage.distanceTraveled).toBeGreaterThanOrEqual(96);
        expect(voyage.log.length).toBeGreaterThan(1); // Init log + Day 1 log
    });

    it('should consume supplies from ship cargo', () => {
        const ship = createMockShip();
        let voyage = VoyageManager.startVoyage(ship, 500);
        const crewCount = ship.crew.members.length;
        const initialFood = ship.cargo.supplies.food;
        const initialWater = ship.cargo.supplies.water;

        const result = VoyageManager.advanceDay(voyage, ship, 1000);
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

        let voyage = VoyageManager.startVoyage(ship, 500);
        const result = VoyageManager.advanceDay(voyage, ship, 1000);
        const updatedShip = result.updatedShip;

        // Check logs for warning
        const lastLog = result.newState.log[result.newState.log.length - 1];
        expect(lastLog.event).toContain('suffering from starvation');
        expect(lastLog.type).toBe('Warning');

        // Check morale hit
        expect(updatedShip.crew.averageMorale).toBeLessThan(80); // Started at 80
    });

    it('should finish voyage when distance is reached', () => {
        const ship = createMockShip();
        let voyage = VoyageManager.startVoyage(ship, 50); // Short trip
        const result = VoyageManager.advanceDay(voyage, ship, 1000);

        expect(result.newState.status).toBe('Docked');
        expect(result.newState.log[result.newState.log.length - 1].event).toContain('Land ho');
    });
});
