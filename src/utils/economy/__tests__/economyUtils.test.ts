
import { describe, it, expect } from 'vitest';
import { calculatePrice } from '../economyUtils';
import { Item, EconomyState } from '../../../types';

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
        expect(buyResult.factors).toContain('Scarcity');

        const sellResult = calculatePrice(mockItem, scarcityEconomy, 'sell');
        expect(sellResult.finalPrice).toBe(7.5); // 10 * 0.5 * 1.5
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
        expect(buyResult.factors).toContain('Surplus');

        const sellResult = calculatePrice(mockItem, surplusEconomy, 'sell');
        expect(sellResult.finalPrice).toBe(2.5); // 10 * 0.5 * 0.5
    });

    it('handles legacy cost strings', () => {
        const stringItem: Item = { ...mockItem, costInGp: undefined, cost: '20 gp' };
        const result = calculatePrice(stringItem, mockEconomy, 'buy');
        expect(result.finalPrice).toBe(20);
    });

    it('returns 0 for unpriced items', () => {
        const freeItem: Item = { ...mockItem, costInGp: undefined, cost: undefined };
        const result = calculatePrice(freeItem, mockEconomy, 'buy');
        expect(result.finalPrice).toBe(0);
    });
});
