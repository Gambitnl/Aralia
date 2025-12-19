
import { describe, it, expect } from 'vitest';
import { BlackMarketSystem } from '../BlackMarketSystem';
import { ContrabandCategory } from '../../../types/crime';

describe('BlackMarketSystem', () => {
    it('generates listings based on demand', () => {
        const listings = BlackMarketSystem.generateListings(
            'loc_1',
            [ContrabandCategory.Narcotics], // Demand
            5 // Supply level
        );

        expect(listings.length).toBeGreaterThan(0);
        listings.forEach(l => {
            expect(l.isIllegal).toBe(true);
            expect(l.price).toBeGreaterThan(0);
        });
    });

    it('calculates high sell price for high demand items', () => {
        const item = {
            id: 'i1',
            name: 'Spice',
            category: ContrabandCategory.Narcotics,
            baseValue: 100,
            legality: {},
            weight: 1,
            volume: 1
        };

        const price = BlackMarketSystem.getSellPrice(item, [ContrabandCategory.Narcotics]);

        // Base 100 * 1.2 = 120
        expect(price).toBe(120);
    });

    it('calculates low sell price for low demand items', () => {
        const item = {
            id: 'i1',
            name: 'Spice',
            category: ContrabandCategory.Narcotics,
            baseValue: 100,
            legality: {},
            weight: 1,
            volume: 1
        };

        const price = BlackMarketSystem.getSellPrice(item, [ContrabandCategory.ExoticCreatures]);

        // Base 100 * 0.4 = 40
        expect(price).toBe(40);
    });
});
