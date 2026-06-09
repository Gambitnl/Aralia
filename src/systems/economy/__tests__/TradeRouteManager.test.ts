import { describe, it, expect, beforeEach } from 'vitest';
import { processDailyRoutes, initializeTradeRoutes } from '../TradeRouteManager';
import { GameState } from '../../../types';
import { TradeRoute } from '../../../types/economy';
import { SeededRandom } from '@/utils/random';
import { calculateMarketFactors } from '@/utils/economy/marketEvents';

describe('TradeRouteManager', () => {
  let mockState: GameState;

  beforeEach(() => {
    mockState = {
      gameTime: new Date().getTime(),
      economy: {
        tradeRoutes: [],
        marketEvents: [],
        marketFactors: { scarcity: [], surplus: [] },
        activeEvents: [],
        buyMultiplier: 1.0,
        sellMultiplier: 0.5,
        globalInflation: 0,
        regionalWealth: {}
      }
    } as unknown as GameState;
  });

  describe('initializeTradeRoutes', () => {
    it('should initialize routes if missing', () => {
      const economy = initializeTradeRoutes(mockState);
      expect(economy.tradeRoutes.length).toBeGreaterThan(0);
      expect(economy.tradeRoutes[0].status).toBeDefined();
    });

    it('should not overwrite existing routes', () => {
      const existing: TradeRoute[] = [{
        id: 'test-route',
        name: 'Test Route',
        originId: 'A',
        destinationId: 'B',
        goods: ['Grain'],
        status: 'active',
        riskLevel: 0.1,
        profitability: 0.5
      }];

      mockState.economy.tradeRoutes = existing;
      const economy = initializeTradeRoutes(mockState);
      expect(economy.tradeRoutes).toBe(existing);
    });
  });

  describe('processDailyRoutes', () => {
    it('keeps route events aligned across marketEvents, activeEvents, and marketFactors', () => {
      const rng = { next: () => 0.01 } as SeededRandom;

      const route: TradeRoute = {
        id: 'r4',
        name: 'River Route',
        originId: 'A',
        destinationId: 'B',
        goods: ['Silk', 'Spice'],
        status: 'active',
        riskLevel: 0.2,
        profitability: 0.2,
        daysInStatus: 5
      };

      mockState.economy.tradeRoutes = [route];

      const result = processDailyRoutes(mockState, 1, rng);
      const { marketEvents, activeEvents, marketFactors } = result.state.economy;

      expect(activeEvents).toEqual(marketEvents);
      expect(marketFactors).toEqual(calculateMarketFactors(marketEvents));
      expect(marketFactors.scarcity).toEqual(expect.arrayContaining(['silk', 'spice']));
      expect(marketFactors.surplus).toEqual([]);
    });

    it('should simulate route changes', () => {
      // Create a predictable RNG mock
      const rng = { next: () => 0.01 } as SeededRandom; // Low roll triggers blockage

      const route: TradeRoute = {
        id: 'r1',
        name: 'Safe Route',
        originId: 'A',
        destinationId: 'B',
        goods: ['Iron'],
        status: 'active',
        riskLevel: 0.5, // High risk + low roll = block
        profitability: 0.5,
        daysInStatus: 0
      };

      mockState.economy.tradeRoutes = [route];

      const result = processDailyRoutes(mockState, 1, rng);
      const newRoute = result.state.economy.tradeRoutes[0];

      expect(newRoute.status).toBe('blockaded');
      // Should generate a blockade event (stored in marketEvents)
      expect(result.state.economy.marketEvents.length).toBe(1);
      expect(result.state.economy.marketFactors.scarcity).toContain('iron');
    });

    it('should recover blocked routes', () => {
      // Roll < recoveryChance (which is > 0.2)
      const rng = { next: () => 0.1 } as SeededRandom;

      const route: TradeRoute = {
        id: 'r1',
        name: 'Blocked Route',
        originId: 'A',
        destinationId: 'B',
        goods: ['Iron'],
        status: 'blockaded',
        riskLevel: 0.1,
        profitability: 0.5,
        daysInStatus: 10
      };

      mockState.economy.tradeRoutes = [route];

      const result = processDailyRoutes(mockState, 1, rng);
      expect(result.state.economy.tradeRoutes[0].status).toBe('active');
      // Should clear scarcity
      expect(result.state.economy.marketFactors.scarcity).not.toContain('iron');
    });

    it('should promote active high-profit routes to booming without a status cast', () => {
      // A high roll avoids blockade and lands inside the boom window for a profitable route.
      const rng = { next: () => 0.99 } as SeededRandom;

      const route: TradeRoute = {
        id: 'r2',
        name: 'Silk Road',
        originId: 'A',
        destinationId: 'B',
        goods: ['Silk'],
        status: 'active',
        riskLevel: 0,
        profitability: 0.5,
        daysInStatus: 3
      };

      mockState.economy.tradeRoutes = [route];

      const result = processDailyRoutes(mockState, 1, rng);
      const newRoute = result.state.economy.tradeRoutes[0];

      expect(newRoute.status).toBe('booming');
      expect(newRoute.daysInStatus).toBe(0);
      expect(result.state.economy.marketFactors.surplus).toContain('silk');
      expect(result.state.economy.marketEvents[0].type).toBe('SURPLUS');
    });

    it('should normalize booming routes back to active', () => {
      // A low roll inside the normalize window ends a boom and clears its surplus factor.
      const rng = { next: () => 0.1 } as SeededRandom;

      const route: TradeRoute = {
        id: 'r3',
        name: 'Gem Road',
        originId: 'A',
        destinationId: 'B',
        goods: ['Gems'],
        status: 'booming',
        riskLevel: 0,
        profitability: 0.5,
        daysInStatus: 2
      };

      mockState.economy.tradeRoutes = [route];

      const result = processDailyRoutes(mockState, 1, rng);
      const newRoute = result.state.economy.tradeRoutes[0];

      expect(newRoute.status).toBe('active');
      expect(newRoute.daysInStatus).toBe(0);
      expect(result.state.economy.marketFactors.surplus).not.toContain('gems');
    });
  });
});
