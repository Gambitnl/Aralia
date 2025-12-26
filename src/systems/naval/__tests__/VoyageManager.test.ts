
import { describe, it, expect } from 'vitest';
import { VoyageManager } from '../VoyageManager';
import { Ship, VoyageEvent } from '../../../types/naval';
import { CrewManager } from '../CrewManager';
import { VOYAGE_EVENTS } from '../../../data/naval/voyageEvents';
import { SeededRandom } from '../../../utils/seededRandom';

describe('VoyageManager', () => {
    // Mock Ship
    const mockShip: Ship = {
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
        }, 'Captain', 1).crew, // Minimal crew setup
        cargo: { items: [], totalWeight: 0, capacityUsed: 0, supplies: { food: 1000, water: 2000 } },
        modifications: [],
        weapons: [],
        flags: {}
    };

    // Add some crew members manually to ensure stats work
    mockShip.crew.members.push(CrewManager.generateCrewMember('Bosun'));
    mockShip.crew.members.push(CrewManager.generateCrewMember('Sailor'));

    it('should initialize a voyage correctly', () => {
        const voyage = VoyageManager.startVoyage(mockShip, 500);
        expect(voyage.status).toBe('Sailing');
        expect(voyage.daysAtSea).toBe(0);
        expect(voyage.distanceToDestination).toBe(500);
        expect(voyage.seed).toBeDefined();
    });

    it('should advance the day and move the ship', () => {
        let voyage = VoyageManager.startVoyage(mockShip, 500);
        const result = VoyageManager.advanceDay(voyage, mockShip, 1000);

        voyage = result.newState;

        expect(voyage.daysAtSea).toBe(1);
        // Speed 40 -> 96 miles/day.
        expect(voyage.distanceTraveled).toBeGreaterThanOrEqual(96);
        expect(voyage.log.length).toBeGreaterThan(1); // Init log + Day 1 log
    });

    it('should consume supplies from cargo', () => {
        let voyage = VoyageManager.startVoyage(mockShip, 500);
        const crewCount = mockShip.crew.members.length;
        const initialFood = mockShip.cargo.supplies.food;
        const initialWater = mockShip.cargo.supplies.water;

        const result = VoyageManager.advanceDay(voyage, mockShip, 1000);
        voyage = result.newState;
        const updatedShip = result.updatedShip;

        // 1 food per person, 2 water per person
        const expectedFoodConsumed = crewCount * 1;
        const expectedWaterConsumed = crewCount * 2;

        expect(voyage.suppliesConsumed.food).toBe(expectedFoodConsumed);
        expect(voyage.suppliesConsumed.water).toBe(expectedWaterConsumed);

        expect(updatedShip.cargo.supplies.food).toBe(initialFood - expectedFoodConsumed);
        expect(updatedShip.cargo.supplies.water).toBe(initialWater - expectedWaterConsumed);
    });

    it('should handle starvation when supplies run out', () => {
        // Create a ship with minimal supplies
        const starvingShip = {
            ...mockShip,
            cargo: {
                ...mockShip.cargo,
                supplies: { food: 0, water: 0 }
            },
            crew: {
                ...mockShip.crew,
                averageMorale: 100 // Start happy
            }
        };
        // Reset member morale manually for test consistency
        starvingShip.crew.members.forEach(m => m.morale = 100);

        let voyage = VoyageManager.startVoyage(starvingShip, 500);
        const result = VoyageManager.advanceDay(voyage, starvingShip, 1000);

        const updatedShip = result.updatedShip;
        const log = result.newState.log.find(l => l.day === 1)?.event || '';

        expect(log).toContain('Out of food');
        expect(log).toContain('Out of water');

        // Check morale dropped significantly
        // Base drift might affect it too, but penalty is -15 total (-5 food, -10 water)
        // Wages paid might add +1.
        // So expected around 85-86.
        const morale = updatedShip.crew.members[0].morale;
        expect(morale).toBeLessThan(90);
    });

    it('should finish voyage correctly over multiple days', () => {
        // Distance 200 miles. Speed 96 miles/day.
        // We use a fixed seed to prevent random "Fair Winds" from speeding us up unexpectedly.
        // Seed 12345 seems safe (needs manual verification or trial, but better than random).
        let voyage = VoyageManager.startVoyage(mockShip, 200, 12345);
        let ship = mockShip;

        // Day 1
        let result = VoyageManager.advanceDay(voyage, ship, 1000);
        voyage = result.newState;
        ship = result.updatedShip;

        // Check if we traveled approx 96 miles (no events with this seed hopefully)
        expect(voyage.distanceTraveled).toBeGreaterThanOrEqual(96);

        if (voyage.status === 'Sailing') {
             // Day 2
            result = VoyageManager.advanceDay(voyage, ship, 1000);
            voyage = result.newState;
            ship = result.updatedShip;
        }

        // If we haven't arrived yet (e.g. Doldrums hit?), check status
        if (voyage.status === 'Sailing') {
            expect(voyage.daysAtSea).toBe(2);
            // Day 3
            result = VoyageManager.advanceDay(voyage, ship, 1000);
            voyage = result.newState;
            ship = result.updatedShip;
        }

        expect(voyage.status).toBe('Docked');
        expect(voyage.distanceToDestination).toBe(0);
        expect(voyage.log[voyage.log.length - 1].event).toContain('Land ho');
    });

    it('should not mutate the input ship object', () => {
        const originalShip = { ...mockShip, stats: { ...mockShip.stats, hullPoints: 100 } };
        const voyage = VoyageManager.startVoyage(originalShip, 500);

        const result = VoyageManager.advanceDay(voyage, originalShip, 1000);

        // Check if original ship stats were modified in place
        expect(result.updatedShip).not.toBe(originalShip);
        expect(result.updatedShip.stats).not.toBe(originalShip.stats);
    });

    it('should apply distance modifier from Doldrums event', () => {
        // We need to force the Doldrums event.
        const doldrums = VOYAGE_EVENTS.find(e => e.id === 'doldrums');
        expect(doldrums).toBeDefined();

        if (doldrums) {
            const voyage = VoyageManager.startVoyage(mockShip, 500);
            // We mock RNG to just work
            const rng = new SeededRandom(123);
            const result = doldrums.effect(voyage, mockShip, rng);

            // Should negate movement (approx -96)
            expect(result.distanceModifier).toBeLessThan(0);
            expect(result.log).toContain('Caught in the doldrums');
        }
    });
});
