import { describe, expect, it, vi } from 'vitest';
import { calculatePrice, parseCost } from '../economy/economyUtils';
import { EconomyState, Item, MarketEventType } from '../../types';

// Mock the regional data to ensure tests are robust and independent of live data changes
vi.mock('../../data/economy/regions', () => ({
  REGIONAL_ECONOMIES: {
    'region_coast': {
      id: 'region_coast',
      name: 'Coastal Cities',
      exports: ['fish', 'salt'],
      imports: ['iron', 'wood'],
      wealthLevel: 50
    },
    'region_mountains': {
      id: 'region_mountains',
      name: 'Iron Peaks',
      exports: ['iron', 'stone'],
      imports: ['food', 'cloth'],
      wealthLevel: 50
    }
  }
}));

describe('economyUtils', () => {
  describe('parseCost', () => {
    it('parses CP/SP/GP/PP into GP', () => {
      expect(parseCost('1 cp')).toBeCloseTo(0.01);
      expect(parseCost('5 sp')).toBeCloseTo(0.5);
      expect(parseCost('2 gp')).toBeCloseTo(2);
      expect(parseCost('1 pp')).toBeCloseTo(10);
    });
  });

  describe('calculatePrice', () => {
    const economy: EconomyState = {
      marketEvents: [],
      tradeRoutes: [],
      marketFactors: { scarcity: [], surplus: [] },
      activeEvents: [],
      buyMultiplier: 1.0,
      sellMultiplier: 0.5,
      globalInflation: 0,
      regionalWealth: {}
    };

    it('does not collapse cheap CP items to 0 when buying', () => {
      const torch: Item = {
        id: 'torch',
        name: 'Torch',
        description: 'A simple torch.',
        type: 'light_source',
        cost: '1 cp',
        costInGp: 0.01,
        weight: 1,
      };

      expect(calculatePrice(torch, economy, 'buy').finalPrice).toBe(0.01);
    });

    it('rounds up to nearest CP when buying', () => {
      const tiny: Item = {
        id: 'tiny',
        name: 'Tiny',
        description: 'Almost free.',
        type: 'consumable',
        cost: '0.001 gp',
        costInGp: 0.001,
        weight: 1,
      };

      // Buying rounds up so this never becomes free.
      expect(calculatePrice(tiny, economy, 'buy').finalPrice).toBe(0.01);
    });

    it('rounds down to nearest CP when selling', () => {
      const torch: Item = {
        id: 'torch',
        name: 'Torch',
        description: 'A simple torch.',
        type: 'light_source',
        cost: '1 cp',
        costInGp: 0.01,
        weight: 1,
      };

      // 0.01 * 0.5 = 0.005, but we enforce a minimum of 0.01 (1 CP).
      expect(calculatePrice(torch, economy, 'sell').finalPrice).toBe(0.01);
    });

    it('applies regional export discounts (Surplus logic)', () => {
      // Mock region_coast exports 'Fish' (case-insensitive match on name part or type)
      // If we buy Fish in region_coast, it should be cheaper
      const fishItem: Item = {
        id: 'fish',
        name: 'Fresh Fish',
        description: 'Tasty.',
        type: 'food',
        costInGp: 10,
        weight: 1
      };

      const result = calculatePrice(fishItem, economy, 'buy', 'region_coast');
      // Base multiplier 1.0
      // Export modifier -0.2
      // Final multiplier 0.8
      // Price 10 * 0.8 = 8
      expect(result.multiplier).toBeCloseTo(0.8);
      expect(result.finalPrice).toBe(8);
    });

    it('applies regional import markups (Scarcity logic)', () => {
      // Mock region_mountains imports 'Food'
      // If we buy Food in region_mountains, it should be more expensive
      const foodItem: Item = {
        id: 'food',
        name: 'Imported Grain',
        description: 'Grain.',
        type: 'food',
        costInGp: 10,
        weight: 1
      };

      const result = calculatePrice(foodItem, economy, 'buy', 'region_mountains');
      // Base multiplier 1.0
      // Import modifier +0.2
      // Final multiplier 1.2
      // Price 10 * 1.2 = 12
      expect(result.multiplier).toBeCloseTo(1.2);
      expect(result.finalPrice).toBe(12);
    });

    it('ignores invalid regions gracefully', () => {
      const item: Item = {
        id: 'generic',
        name: 'Generic',
        description: 'Generic item.',
        type: 'misc',
        costInGp: 10,
        weight: 1
      };
      const result = calculatePrice(item, economy, 'buy', 'invalid_region_id');
      expect(result.multiplier).toBe(1.0);
      expect(result.finalPrice).toBe(10);
    });

    it('applies dynamic pricing from MarketEvents (SHORTAGE)', () => {
      const item: Item = {
        id: 'iron',
        name: 'Iron Ingot',
        description: 'Metal.',
        type: 'material',
        costInGp: 10,
        weight: 1
      };

      const eventEconomy: EconomyState = {
        ...economy,
        marketEvents: [{
          id: 'evt_1',
          type: MarketEventType.SHORTAGE,
          name: 'Shortage of Iron',
          startTime: 0,
          duration: 1,
          intensity: 0.8 // Severe shortage
        }]
      };

      const result = calculatePrice(item, eventEconomy, 'buy');
      // Base 1.0 + 0.8 = 1.8 multiplier
      expect(result.multiplier).toBeCloseTo(1.8);
      expect(result.finalPrice).toBe(18);
    });

    it('applies dynamic pricing from MarketEvents (SURPLUS)', () => {
      const item: Item = {
        id: 'wood',
        name: 'Wood Plank',
        description: 'Wood.',
        type: 'material',
        costInGp: 10,
        weight: 1
      };

      const eventEconomy: EconomyState = {
        ...economy,
        marketEvents: [{
          id: 'evt_2',
          type: MarketEventType.SURPLUS,
          name: 'Boom: Wood',
          startTime: 0,
          duration: 1,
          intensity: 0.5
        }]
      };

      const result = calculatePrice(item, eventEconomy, 'buy');
      // Base 1.0 - 0.5 = 0.5 multiplier
      expect(result.multiplier).toBeCloseTo(0.5);
      expect(result.finalPrice).toBe(5);
    });
  });
});
