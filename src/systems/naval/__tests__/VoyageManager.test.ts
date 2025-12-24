
import { describe, it, expect } from 'vitest';
import { VoyageManager } from '../VoyageManager';
import { Ship } from '../../../types/naval';
import { CrewManager } from '../CrewManager';

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
        cargo: { items: [], totalWeight: 0, capacityUsed: 0, supplies: { food: 100, water: 200 } },
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

    it('should consume supplies from ship cargo', () => {
        let voyage = VoyageManager.startVoyage(mockShip, 500);
        const crewCount = mockShip.crew.members.length;
        const initialFood = mockShip.cargo.supplies.food;
        const initialWater = mockShip.cargo.supplies.water;

        const result = VoyageManager.advanceDay(voyage, mockShip, 1000);
        const updatedShip = result.updatedShip;

        // 1 food per person, 2 water per person
        expect(updatedShip.cargo.supplies.food).toBe(initialFood - crewCount);
        expect(updatedShip.cargo.supplies.water).toBe(initialWater - (crewCount * 2));
    });

    it('should handle starvation (empty supplies)', () => {
        const starvingShip: Ship = JSON.parse(JSON.stringify(mockShip));
        starvingShip.cargo.supplies.food = 0; // No food!

        const voyage = VoyageManager.startVoyage(starvingShip, 500);
        const result = VoyageManager.advanceDay(voyage, starvingShip, 1000);

        // Check log for starvation warning
        const lastLog = result.newState.log[result.newState.log.length - 1];
        expect(lastLog.event).toContain('hungry');
        expect(lastLog.type).toBe('Warning');

        // Check morale hit (Starvation hit is -5)
        // Note: Daily update drifts morale towards 50 (-1 if >50).
        // Initial 80 -> 79 (daily) - 5 (starvation) = 74.
        const initialMorale = starvingShip.crew.members[0].morale; // 80
        const newMorale = result.updatedShip.crew.members[0].morale;

        expect(newMorale).toBeLessThan(initialMorale);
    });
});
