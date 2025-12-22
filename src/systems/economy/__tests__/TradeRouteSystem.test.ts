import { describe, it, expect } from 'vitest';
import { TradeRouteSystem } from '../TradeRouteSystem';
import { TradeRoute , MarketEventType } from '../../../types/economy';


describe('TradeRouteSystem', () => {
  const mockRoute: TradeRoute = {
    id: 'test_route',
    name: 'Test Route',
    originId: 'region_mountains', // Exports: iron, weapon
    destinationId: 'region_coast', // Imports: weapon
    goods: ['weapon'],
    status: 'active',
    riskLevel: 0.2,
    profitability: 0.5
  };

  it('calculates high profitability for optimal routes (Supply -> Demand)', () => {
    // Mountains export weapons, Coast imports weapons. Should be high profit.
    const profit = TradeRouteSystem.calculateProfitability(mockRoute, []);

    // Base 50 + 20 (Export) + 30 (Import) - 4 (Risk 0.2*20) = 96
    expect(profit).toBeGreaterThan(80);
  });

  it('calculates low profitability for poor routes (Demand -> Supply)', () => {
    const badRoute: TradeRoute = {
      ...mockRoute,
      originId: 'region_coast', // Does NOT export weapon
      destinationId: 'region_mountains', // Exports weapon
    };

    const profit = TradeRouteSystem.calculateProfitability(badRoute, []);

    expect(profit).toBeLessThan(50);
  });

  it('increases profitability during Shortage events (High Prices)', () => {
    const warEvent = {
      id: 'war',
      type: MarketEventType.SHORTAGE,
      name: 'War shortage',
      description: 'War',
      locationId: undefined,
      startTime: 0,
      duration: 10,
      intensity: 1.0,
      affectedCategories: ['weapon'],
      priceModifier: 1.5
    };

    const profitNormal = TradeRouteSystem.calculateProfitability(mockRoute, []);
    const profitWar = TradeRouteSystem.calculateProfitability(mockRoute, [warEvent as any]);

    expect(profitWar).toBeGreaterThan(profitNormal);
  });

  it('increases risk during dangerous events', () => {
    const banditEvent = {
      id: 'bandits',
      type: MarketEventType.BUST,
      name: 'Bandit Activity',
      description: 'Roads are dangerous',
      startTime: 0,
      duration: 10,
      intensity: 1.0,
      affectedCategories: [],
      priceModifier: 1.0
    };

    const riskNormal = TradeRouteSystem.calculateRisk(mockRoute, []);
    const riskBandits = TradeRouteSystem.calculateRisk(mockRoute, [banditEvent as any]);

    expect(riskBandits).toBeGreaterThan(riskNormal);
  });
});
