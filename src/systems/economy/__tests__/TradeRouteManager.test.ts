import { describe, it, expect, beforeEach } from 'vitest';
import { processDailyRoutes, initializeTradeRoutes } from '../TradeRouteManager';
import { GameState } from '../../../types';
import { TradeRoute } from '../../../types/economy';
import { INITIAL_TRADE_ROUTES } from '../../../data/tradeRoutes';
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

    it('does not force every production route into a boom on an ordinary daily roll', () => {
      mockState.economy.tradeRoutes = INITIAL_TRADE_ROUTES.map(route => ({...route}));
      const result = processDailyRoutes(mockState, 1, {next:()=>0.5} as SeededRandom);
      expect(result.state.economy.tradeRoutes.map(route=>route.status)).toEqual(INITIAL_TRADE_ROUTES.map(()=> 'active'));
      expect(result.state.economy.marketEvents).toEqual([]);
    });

    it('keeps real production boom intensities within their declared range', () => {
      mockState.economy.tradeRoutes = INITIAL_TRADE_ROUTES.map(route => ({...route,status:'booming'}));
      const result = processDailyRoutes(mockState, 1, {next:()=>0.8} as SeededRandom);
      expect(result.state.economy.marketEvents).toHaveLength(14);
      expect(result.state.economy.marketEvents.every(event=>event.intensity >= 0.3 && event.intensity <= 0.6)).toBe(true);
      expect(result.state.economy.marketEvents.find(event=>event.id.includes('route_salt_run_food'))?.intensity).toBeCloseTo(0.57);
      expect(result.state.economy.tradeRoutes.map(route=>route.id)).toEqual(INITIAL_TRADE_ROUTES.map(route=>route.id));
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
        profitability: 50,
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

    it('should disrupt active routes without a full blockade (partial impact)', () => {
      // A roll between blockChance (0.05) and blockChance+disruptChance (0.125)
      // lands the route in the partial-impact `disrupted` state.
      const rng = { next: () => 0.1 } as SeededRandom;

      const route: TradeRoute = {
        id: 'r5',
        name: 'Caravan Route',
        originId: 'A',
        destinationId: 'B',
        goods: ['Grain'],
        status: 'active',
        riskLevel: 0.5,
        profitability: 0.5,
        daysInStatus: 0
      };

      mockState.economy.tradeRoutes = [route];

      const result = processDailyRoutes(mockState, 1, rng);
      expect(result.state.economy.tradeRoutes[0].status).toBe('disrupted');
    });

    it('should recover disrupted routes back to active', () => {
      const rng = { next: () => 0.1 } as SeededRandom;

      const route: TradeRoute = {
        id: 'r6',
        name: 'Disrupted Route',
        originId: 'A',
        destinationId: 'B',
        goods: ['Timber'],
        status: 'disrupted',
        riskLevel: 0.1,
        profitability: 0.5,
        daysInStatus: 0
      };

      mockState.economy.tradeRoutes = [route];

      const result = processDailyRoutes(mockState, 1, rng);
      expect(result.state.economy.tradeRoutes[0].status).toBe('active');
    });

    it('should escalate disrupted routes to blockaded on a severe risk event', () => {
      const rng = { next: () => 0.01 } as SeededRandom;

      const route: TradeRoute = {
        id: 'r7',
        name: 'Disrupted Route',
        originId: 'A',
        destinationId: 'B',
        goods: ['Ore'],
        status: 'disrupted',
        riskLevel: 0.5,
        profitability: 0.5,
        daysInStatus: 0
      };

      mockState.economy.tradeRoutes = [route];

      const result = processDailyRoutes(mockState, 1, rng);
      expect(result.state.economy.tradeRoutes[0].status).toBe('blockaded');
    });
  });
});
