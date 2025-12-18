/**
 * @file src/utils/__tests__/economyUtils.test.ts
 */
import { describe, it, expect } from 'vitest';
import { calculatePrice, parseCost } from '../economyUtils';
import { Item, EconomyState } from '@/types';

describe('economyUtils', () => {
    const mockItem: Item = {
        id: 'test_sword',
        name: 'Test Sword',
        type: 'weapon',
        value: 100,
        description: 'A sharp blade',
        icon: 'sword',
        weight: 2
    };

    const mockItemStringCost: Item = {
        id: 'test_legacy',
        name: 'Legacy Item',
        type: 'misc',
        cost: '50 GP',
        description: 'Old item',
        icon: 'box',
        weight: 1
    };

    const defaultEconomy: EconomyState = {
        marketFactors: { scarcity: [], surplus: [] },
        buyMultiplier: 1.0,
        sellMultiplier: 0.5,
        activeEvents: []
    };

    describe('parseCost', () => {
        it('parses GP correctly', () => {
            expect(parseCost('100 GP')).toBe(100);
            expect(parseCost('50 gp')).toBe(50);
        });

        it('parses PP correctly', () => {
            expect(parseCost('10 PP')).toBe(100);
        });

        it('parses SP correctly', () => {
            expect(parseCost('10 SP')).toBe(1);
        });

        it('returns 0 for invalid or empty strings', () => {
            expect(parseCost('')).toBe(0);
            expect(parseCost(undefined)).toBe(0);
            expect(parseCost('free')).toBe(0);
        });
    });

    describe('calculatePrice', () => {
        it('calculates base buy price correctly (numeric value)', () => {
            const result = calculatePrice(mockItem, defaultEconomy, 'buy');
            expect(result.finalPrice).toBe(100);
            expect(result.multiplier).toBe(1.0);
            expect(result.isModified).toBe(false);
        });

        it('calculates base buy price correctly (string cost)', () => {
            const result = calculatePrice(mockItemStringCost, defaultEconomy, 'buy');
            expect(result.finalPrice).toBe(50);
        });

        it('calculates base sell price correctly', () => {
            const result = calculatePrice(mockItem, defaultEconomy, 'sell');
            expect(result.finalPrice).toBe(50);
            expect(result.multiplier).toBe(0.5);
        });

        it('increases price during scarcity', () => {
            const scarcityEconomy: EconomyState = {
                ...defaultEconomy,
                marketFactors: { scarcity: ['weapon'], surplus: [] }
            };
            const buyResult = calculatePrice(mockItem, scarcityEconomy, 'buy');
            // 1.0 + 0.5 = 1.5 multiplier
            // 100 * 1.5 = 150
            expect(buyResult.finalPrice).toBe(150);
            expect(buyResult.multiplier).toBe(1.5);
            expect(buyResult.isModified).toBe(true);

            const sellResult = calculatePrice(mockItem, scarcityEconomy, 'sell');
            // 0.5 + 0.3 = 0.8 multiplier
            // 100 * 0.8 = 80
            expect(sellResult.finalPrice).toBe(80);
        });

        it('decreases price during surplus', () => {
            const surplusEconomy: EconomyState = {
                ...defaultEconomy,
                marketFactors: { scarcity: [], surplus: ['weapon'] }
            };
            const buyResult = calculatePrice(mockItem, surplusEconomy, 'buy');
            // 1.0 - 0.3 = 0.7 multiplier
            // 100 * 0.7 = 70
            expect(buyResult.finalPrice).toBe(70);
            expect(buyResult.isModified).toBe(true);

            const sellResult = calculatePrice(mockItem, surplusEconomy, 'sell');
            // 0.5 - 0.2 = 0.3 multiplier
            // 100 * 0.3 = 30
            expect(sellResult.finalPrice).toBe(30);
        });

        it('handles zero value items', () => {
            const junkItem: Item = { ...mockItem, value: 0 };
            const result = calculatePrice(junkItem, defaultEconomy, 'buy');
            expect(result.finalPrice).toBe(0);
        });

        it('handles missing economy gracefully', () => {
            const result = calculatePrice(mockItem, undefined, 'buy');
            expect(result.finalPrice).toBe(100);
            expect(result.isModified).toBe(false);
        });
    });
});
