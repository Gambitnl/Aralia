
import { describe, it, expect, vi } from 'vitest';
import { SmugglingSystem } from '../SmugglingSystem';
import { SmugglingRoute, ContrabandCategory, InspectionResult } from '../../../types/crime';
import { PlayerCharacter } from '../../../types/character';
import { createMockPlayerCharacter } from '../../../utils/factories';

describe('SmugglingSystem', () => {
    const mockRoute: SmugglingRoute = {
        id: 'route_1',
        originLocationId: 'loc_a',
        destinationLocationId: 'loc_b',
        baseRisk: 20,
        patrolFrequency: 5,
        inspectionStrictness: 2,
        lengthKm: 100
    };

    const mockCargo = [
        {
            id: 'c1',
            name: 'Drugs',
            category: ContrabandCategory.Narcotics,
            baseValue: 100,
            legality: {},
            weight: 5,
            volume: 2
        },
        {
            id: 'c2',
            name: 'Weapons',
            category: ContrabandCategory.ForbiddenTech,
            baseValue: 200,
            legality: {},
            weight: 10,
            volume: 3
        }
    ];

    const mockPlayer = createMockPlayerCharacter({
        stats: {
            strength: 10,
            dexterity: 16, // +3 mod
            constitution: 10,
            intelligence: 10,
            wisdom: 10,
            charisma: 14 // +2 mod
        }
    });

    it('calculates risk correctly based on cargo and player stats', () => {
        // Base: 20
        // Volume: (2+3) * 2 = 10
        // Dex Mod: 3 * 2 = 6 (reduction)
        // Expected: 20 + 10 - 6 = 24

        const risk = SmugglingSystem.calculateRunRisk(mockRoute, mockCargo, mockPlayer);
        expect(risk).toBe(24);
    });

    it('reduces risk with concealment plans', () => {
        const risk = SmugglingSystem.calculateRunRisk(mockRoute, mockCargo, mockPlayer, 'magic');
        // Expected: 24 - 25 = -1 -> clamped to 5
        expect(risk).toBe(5);
    });

    it('triggers inspection based on probability', () => {
        // Force inspection by mocking SeededRandom or just high risk?
        // Let's rely on the method using a seed if provided, or just checking logic.
        // Since we can't easily mock the internal random without dependency injection or module mock,
        // we'll trust the logic: if roll <= risk, return event.

        // Let's modify checkForInspection to accept a seed for testing if we updated the class.
        // I updated it to accept a seed!

        // Seed that produces low number?
        // Note: SeededRandom implementation details might vary.
        // Let's assume a high risk always triggers it relative to the random.

        const event = SmugglingSystem.checkForInspection(mockRoute, 100); // 100% risk
        expect(event).not.toBeNull();
        expect(event?.routeId).toBe(mockRoute.id);
    });

    it('resolves bribe correctly', () => {
        const event = {
            routeId: 'r1',
            difficulty: 15,
            guardsCount: 2,
            canBribe: true,
            bribeCost: 100
        };

        const richPlayer = { ...mockPlayer, gold: 500 };
        const result = SmugglingSystem.resolveInspection(event, 'bribe', richPlayer, mockCargo);

        expect(result.result).toBe(InspectionResult.BribeSuccess);
    });

    it('fails bribe if poor', () => {
        const event = {
            routeId: 'r1',
            difficulty: 15,
            guardsCount: 2,
            canBribe: true,
            bribeCost: 1000
        };

        const poorPlayer = { ...mockPlayer, gold: 10 };
        const result = SmugglingSystem.resolveInspection(event, 'bribe', poorPlayer, mockCargo);

        expect(result.result).toBe(InspectionResult.BribeFailure);
    });

    it('confiscates goods on surrender', () => {
        const event = {
            routeId: 'r1',
            difficulty: 15,
            guardsCount: 2,
            canBribe: false,
            bribeCost: 0
        };

        const result = SmugglingSystem.resolveInspection(event, 'submit', mockPlayer, mockCargo);

        expect(result.result).toBe(InspectionResult.Confiscation);
        expect(result.itemsLost).toHaveLength(2);
    });
});
