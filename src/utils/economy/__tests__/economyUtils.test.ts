
import { describe, it, expect } from 'vitest';
import { calculatePrice, parseCost } from '../economyUtils';
import { Item, EconomyState } from '../../../types';
import { REGIONAL_ECONOMIES } from '../../../data/economy/regions';

describe('economyUtils', () => {
    const mockEconomy: EconomyState = {
        marketEvents: [],
        tradeRoutes: [],
        globalInflation: 0,
        regionalWealth: {},
        marketFactors: {
            scarcity: [],
            surplus: []
        },
        buyMultiplier: 1.0,
        sellMultiplier: 0.5,
        activeEvents: []
    };

    const mockItem: Item = {
        id: 'test_sword',
        name: 'Test Sword',
        description: 'A sharp blade.',
        type: 'Weapon',
        tags: ['weapon', 'metal'],
        costInGp: 10,
        weight: 3,
        rarity: 'common'
    };

    it('calculates standard buy price correctly', () => {
        const result = calculatePrice(mockItem, mockEconomy, 'buy');
        expect(result.finalPrice).toBe(10);
        expect(result.multiplier).toBe(1.0);
        expect(result.isModified).toBe(false);
    });

    it('calculates standard sell price correctly', () => {
        const result = calculatePrice(mockItem, mockEconomy, 'sell');
        expect(result.finalPrice).toBe(5);
        expect(result.multiplier).toBe(0.5);
        expect(result.isModified).toBe(false);
    });

    it('applies scarcity modifier (price increase)', () => {
        const scarcityEconomy = {
            ...mockEconomy,
            marketFactors: {
                scarcity: ['weapon'],
                surplus: []
            }
        };

        const buyResult = calculatePrice(mockItem, scarcityEconomy, 'buy');
        expect(buyResult.finalPrice).toBe(15); // 10 * 1.5
        expect(buyResult.factors).toContain('Global Scarcity');
    });

    it('applies surplus modifier (price decrease)', () => {
        const surplusEconomy = {
            ...mockEconomy,
            marketFactors: {
                scarcity: [],
                surplus: ['metal']
            }
        };

        const buyResult = calculatePrice(mockItem, surplusEconomy, 'buy');
        expect(buyResult.finalPrice).toBe(5); // 10 * 0.5
        expect(buyResult.factors).toContain('Global Surplus');
    });

    it('handles legacy cost strings', () => {
        const stringItem: Item = { ...mockItem, costInGp: undefined, cost: '20 gp' };
        const result = calculatePrice(stringItem, mockEconomy, 'buy');
        expect(result.finalPrice).toBe(20);
    });

    it('parses platinum correctly', () => {
        expect(parseCost('1 pp')).toBe(10);
        expect(parseCost('50 pp')).toBe(500);
    });

    it('returns 0 for unpriced items', () => {
        const freeItem: Item = { ...mockItem, costInGp: undefined, cost: undefined };
        const result = calculatePrice(freeItem, mockEconomy, 'buy');
        expect(result.finalPrice).toBe(0);
    });

    it('applies regional economics', () => {
        // Find a region that imports 'weapon' -> region_coast imports 'weapon'
        const regionId = 'region_coast';
        // Ensure the region exists in mock data logic or real data
        // Note: The utility uses REGIONAL_ECONOMIES imported from data.
        // We assume it's available.

        const result = calculatePrice(mockItem, mockEconomy, 'buy', regionId);
        // Imports increase price by 1.25
        expect(result.multiplier).toBe(1.25);
        expect(result.finalPrice).toBe(12.5);
        expect(result.factors[0]).toContain('Regional Import');
    });
});
