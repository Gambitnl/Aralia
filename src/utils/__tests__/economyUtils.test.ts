import { describe, it, expect } from 'vitest';
import { generateMarketEvents, applyEventsToEconomy, calculateTradeRouteProfit, POSSIBLE_MARKET_EVENTS, MarketEvent } from '../economyUtils';
import { EconomyState } from '@/types';

describe('economyUtils', () => {
  describe('generateMarketEvents', () => {
    it('should be deterministic based on seed', () => {
      const seed = 12345;
      const events1 = generateMarketEvents(seed);
      const events2 = generateMarketEvents(seed);
      expect(events1).toEqual(events2);
    });

    it('should return different results for different seeds', () => {
      const seed1 = 12345;
      const seed2 = 2;

      // We loop until we find two seeds that produce different results, or fail if we can't.
      // This is necessary because "no event" is a valid and common result (60% chance).
      let events1 = generateMarketEvents(seed1);
      let events2 = generateMarketEvents(seed2);

      let foundDifference = false;
      for (let i = 0; i < 100; i++) {
         events1 = generateMarketEvents(i);
         events2 = generateMarketEvents(i + 1);
         if (JSON.stringify(events1) !== JSON.stringify(events2)) {
             foundDifference = true;
             break;
         }
      }

      expect(foundDifference).toBe(true);
    });
  });

  describe('applyEventsToEconomy', () => {
    const baseEconomy: EconomyState = {
      marketFactors: { scarcity: [], surplus: [] },
      buyMultiplier: 1.0,
      sellMultiplier: 0.5,
    };

    it('should add scarcity tags', () => {
      const event: MarketEvent = {
        id: 'test_scarcity',
        name: 'Test Scarcity',
        description: '',
        affectedTags: ['apple', 'bread'],
        effect: 'scarcity',
        duration: 1
      };

      const newEconomy = applyEventsToEconomy(baseEconomy, [event]);
      expect(newEconomy.marketFactors.scarcity).toContain('apple');
      expect(newEconomy.marketFactors.scarcity).toContain('bread');
    });

    it('should add surplus tags', () => {
       const event: MarketEvent = {
        id: 'test_surplus',
        name: 'Test Surplus',
        description: '',
        affectedTags: ['water'],
        effect: 'surplus',
        duration: 1
      };

      const newEconomy = applyEventsToEconomy(baseEconomy, [event]);
      expect(newEconomy.marketFactors.surplus).toContain('water');
    });

    it('should have scarcity override surplus', () => {
       const eventSurplus: MarketEvent = {
        id: 'test_surplus',
        name: 'Test Surplus',
        description: '',
        affectedTags: ['iron'],
        effect: 'surplus',
        duration: 1
      };
      const eventScarcity: MarketEvent = {
        id: 'test_scarcity',
        name: 'Test Scarcity',
        description: '',
        affectedTags: ['iron'],
        effect: 'scarcity',
        duration: 1
      };

      // Case 1: Scarcity applied after Surplus
      let newEconomy = applyEventsToEconomy(baseEconomy, [eventSurplus, eventScarcity]);
      expect(newEconomy.marketFactors.scarcity).toContain('iron');
      expect(newEconomy.marketFactors.surplus).not.toContain('iron');

      // Case 2: Scarcity applied before Surplus (Surplus should assume Scarcity wins)
      newEconomy = applyEventsToEconomy(baseEconomy, [eventScarcity, eventSurplus]);
      expect(newEconomy.marketFactors.scarcity).toContain('iron');
      expect(newEconomy.marketFactors.surplus).not.toContain('iron');
    });
  });

  describe('calculateTradeRouteProfit', () => {
    it('should increase profit with distance', () => {
      const baseValue = 100;
      const profitShort = calculateTradeRouteProfit(10, 0, baseValue);
      const profitLong = calculateTradeRouteProfit(100, 0, baseValue);
      expect(profitLong).toBeGreaterThan(profitShort);
    });

    it('should increase profit with risk', () => {
      const baseValue = 100;
      const profitSafe = calculateTradeRouteProfit(10, 0, baseValue);
      const profitRisky = calculateTradeRouteProfit(10, 5, baseValue);
      expect(profitRisky).toBeGreaterThan(profitSafe);
    });
  });
});
