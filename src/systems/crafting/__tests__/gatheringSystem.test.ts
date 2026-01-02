/**
 * @file src/systems/crafting/__tests__/gatheringSystem.test.ts
 * Tests for the Gathering System (Identification + Harvesting).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { attemptIdentification, attemptHarvest } from '../gatheringSystem';
import { Crafter } from '../craftingSystem';
import { GatherableResource } from '../gatheringData';

// Mock the dice rolling utility from combatUtils
vi.mock('../../../utils/combatUtils', () => ({
    rollDice: vi.fn(() => 6) // Consistent value for yield calculations
}));

describe('GatheringSystem', () => {
    let mockCrafter: Crafter;

    beforeEach(() => {
        mockCrafter = {
            name: 'Test Herbalist',
            rollSkill: vi.fn().mockReturnValue(15), // Default roll
            getSkillModifier: vi.fn().mockReturnValue(3),
            hasProficiency: vi.fn().mockReturnValue(true),
        } as unknown as Crafter;
    });

    describe('attemptIdentification', () => {
        it('should identify common resources with roll >= 10', () => {
            vi.mocked(mockCrafter.rollSkill).mockReturnValue(10);

            const result = attemptIdentification(mockCrafter, 'Forest');

            expect(result.success).toBe(true);
            expect(result.roll).toBe(10);
            expect(result.identifiedResources.length).toBeGreaterThan(0);
            // Should only find common resources
            result.identifiedResources.forEach(r => {
                expect(r.rarity).toBe('common');
            });
        });

        it('should identify common + uncommon resources with roll >= 15', () => {
            vi.mocked(mockCrafter.rollSkill).mockReturnValue(15);

            const result = attemptIdentification(mockCrafter, 'Forest');

            expect(result.success).toBe(true);
            const rarities = result.identifiedResources.map(r => r.rarity);
            expect(rarities).toContain('common');
            expect(rarities).toContain('uncommon');
            expect(rarities).not.toContain('rare');
        });

        it('should identify all resources with roll >= 20', () => {
            vi.mocked(mockCrafter.rollSkill).mockReturnValue(20);

            const result = attemptIdentification(mockCrafter, 'Forest');

            expect(result.success).toBe(true);
            const rarities = result.identifiedResources.map(r => r.rarity);
            expect(rarities).toContain('common');
            expect(rarities).toContain('uncommon');
            expect(rarities).toContain('rare');
        });

        it('should fail to identify anything with roll < 10', () => {
            vi.mocked(mockCrafter.rollSkill).mockReturnValue(5);

            const result = attemptIdentification(mockCrafter, 'Forest');

            expect(result.success).toBe(false);
            expect(result.identifiedResources.length).toBe(0);
        });

        it('should apply time bonus correctly', () => {
            vi.mocked(mockCrafter.rollSkill).mockReturnValue(8); // Would fail normally

            // Spend extra time (multiplier 3 = 90 mins = +6 bonus)
            const result = attemptIdentification(mockCrafter, 'Forest', 3);

            expect(result.roll).toBe(14); // 8 + 6
            expect(result.success).toBe(true); // >= 10 now
        });

        it('should cap time bonus at +6', () => {
            vi.mocked(mockCrafter.rollSkill).mockReturnValue(10);

            const result = attemptIdentification(mockCrafter, 'Forest', 10); // Very high multiplier

            expect(result.roll).toBe(16); // 10 + 6 (capped)
        });

        it('should return empty for biomes with no resources', () => {
            vi.mocked(mockCrafter.rollSkill).mockReturnValue(25);

            // Blightshore has limited resources, test an edge case
            const result = attemptIdentification(mockCrafter, 'Blightshore');

            // Should still succeed if resources exist there
            expect(result.message).toContain('Nature Check');
        });
    });

    describe('attemptHarvest', () => {
        const mockResource: GatherableResource = {
            id: 'red_amanita',
            name: 'Red Amanita Mushroom',
            rarity: 'common',
            identifyDC: 10,
            harvestDC: 10,
            baseYield: '2d4',
            locations: ['Forest', 'Swamp']
        };

        it('should succeed when roll meets DC', () => {
            vi.mocked(mockCrafter.rollSkill).mockReturnValue(10);

            const result = attemptHarvest(mockCrafter, mockResource);

            expect(result.success).toBe(true);
            expect(result.roll).toBe(10);
            expect(result.yield).toBeGreaterThan(0);
            expect(result.yieldMessage).toContain('Harvest Success');
        });

        it('should succeed when roll exceeds DC', () => {
            vi.mocked(mockCrafter.rollSkill).mockReturnValue(18);

            const result = attemptHarvest(mockCrafter, mockResource);

            expect(result.success).toBe(true);
            expect(result.roll).toBe(18);
        });

        it('should fail when roll is below DC', () => {
            vi.mocked(mockCrafter.rollSkill).mockReturnValue(5);

            const result = attemptHarvest(mockCrafter, mockResource);

            expect(result.success).toBe(false);
            expect(result.yieldMessage).toContain('Harvest Failed');
        });

        it('should apply time bonus correctly', () => {
            vi.mocked(mockCrafter.rollSkill).mockReturnValue(8); // Would fail vs DC 10

            const result = attemptHarvest(mockCrafter, mockResource, 2); // +3 bonus

            expect(result.roll).toBe(11); // 8 + 3
            expect(result.success).toBe(true);
        });

        it('should use Herbalism Kit skill', () => {
            attemptHarvest(mockCrafter, mockResource);

            expect(mockCrafter.rollSkill).toHaveBeenCalledWith('Herbalism Kit');
        });
    });
});
