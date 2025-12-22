
import { describe, it, expect, vi, afterEach } from 'vitest';
import { VoyageManager } from '../voyage/VoyageManager';
import { Ship, VoyageState } from '../../../types/naval';
import { v4 as uuidv4 } from 'uuid';

describe('VoyageManager', () => {
    const mockShip: Ship = {
        id: uuidv4(),
        name: 'The Rusty Tub',
        type: 'Sloop',
        size: 'Small',
        description: 'A test ship',
        stats: {
            speed: 30, // 30ft/round ~ 3mph ~ 72 miles/day
            maneuverability: 0,
            hullPoints: 100,
            maxHullPoints: 100,
            armorClass: 12,
            cargoCapacity: 10,
            crewMin: 5,
            crewMax: 10
        },
        crew: {
            members: Array(5).fill({ id: '1', name: 'Sailor', role: 'Sailor', morale: 80, dailyWage: 1, traits: [] }),
            averageMorale: 80,
            unrest: 0,
            quality: 'Average'
        },
        cargo: {
            items: [],
            totalWeight: 0,
            capacityUsed: 0,
            supplies: {
                food: 100,
                water: 100
            }
        },
        modifications: [],
        weapons: [],
        flags: {}
    };

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('starts a voyage correctly', () => {
        const voyage = VoyageManager.startVoyage(mockShip, 500);
        expect(voyage.status).toBe('Sailing');
        expect(voyage.distanceToDestination).toBe(500);
        expect(voyage.daysAtSea).toBe(0);
    });

    it('consumes supplies daily', () => {
        // Mock random to pick smooth sailing (index 0)
        vi.spyOn(Math, 'random').mockReturnValue(0.0);

        const voyage = VoyageManager.startVoyage(mockShip, 500);
        const result = VoyageManager.advanceDay(voyage, mockShip);

        // 5 crew members = 5 food, 5 water
        expect(result.ship.cargo.supplies.food).toBe(95);
        expect(result.ship.cargo.supplies.water).toBe(95);
        expect(result.state.suppliesConsumed.food).toBe(5);
    });

    it('handles starvation when food runs out', () => {
        // Mock random to pick smooth sailing (index 0) to avoid interference
        vi.spyOn(Math, 'random').mockReturnValue(0.0);

        const poorShip = { ...mockShip, cargo: { ...mockShip.cargo, supplies: { food: 0, water: 100 } } };
        // Deep copy crew to avoid mutation of mock
        poorShip.crew = JSON.parse(JSON.stringify(mockShip.crew));

        const voyage = VoyageManager.startVoyage(poorShip, 500);
        const result = VoyageManager.advanceDay(voyage, poorShip);

        expect(result.state.log.some(l => l.event.includes('Out of food'))).toBe(true);
        // Morale should drop (starts at 80, -10 = 70)
        // Note: modifyCrewMorale is a static method on CrewManager.
        // We are checking the result ship state.
        expect(result.ship.crew.members[0].morale).toBe(70);
    });

    it('arrives at destination', () => {
        // Mock random to pick smooth sailing (index 0)
        vi.spyOn(Math, 'random').mockReturnValue(0.0);

        // High speed ship to arrive in 1 day
        const fastShip = { ...mockShip, stats: { ...mockShip.stats, speed: 500 } }; // Very fast
        const voyage = VoyageManager.startVoyage(fastShip, 10);

        const currentState = voyage;
        const currentShip = fastShip;

        // Let's manually set distance to 0 to test the check logic.
        currentState.distanceToDestination = 0;
        const result = VoyageManager.advanceDay(currentState, currentShip);

        expect(result.state.status).toBe('Docked');
    });
});
