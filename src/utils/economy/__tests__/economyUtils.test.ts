import { describe, expect, it, vi } from 'vitest';
import { calculatePrice, parseCost } from '../economyUtils';
import { EconomyState, Item, MarketEventType, ItemType, MarketEvent } from '../../../types';

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
        type: ItemType.LightSource,
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
        type: ItemType.Consumable,
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
        type: ItemType.LightSource,
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
        type: ItemType.FoodDrink,
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
        type: ItemType.FoodDrink,
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
        type: ItemType.Treasure,
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
        type: ItemType.CraftingMaterial,
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
        type: ItemType.CraftingMaterial,
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

    it('prefers typed event tags over name-only parsing for event application', () => {
      const item: Item = {
        id: 'broadsword',
        name: 'Merchant Blade',
        description: 'A blade for sale.',
        type: ItemType.Weapon,
        costInGp: 10,
        weight: 3
      };

      const eventEconomy: EconomyState = {
        ...economy,
        marketEvents: [{
          id: 'evt_typed',
          type: MarketEventType.SHORTAGE,
          name: 'Regional fluctuation',
          startTime: 0,
          duration: 1,
          intensity: 0.8,
          affectedTags: ['weapon']
        } as MarketEvent]
      };

      const result = calculatePrice(item, eventEconomy, 'buy');
      // Base 1.0 + 0.8 from SHORTAGE for weapon-tagged event.
      expect(result.multiplier).toBeCloseTo(1.8);
      expect(result.finalPrice).toBe(18);
    });
    it('does not match unrelated goods through substring overlap (GG-443 / agora-76f7)', () => {
      // Food Shortage (tags: consumable, food)
      const foodShortageEconomy: EconomyState = {
        ...economy,
        marketEvents: [{
          id: 'evt_food_shortage',
          type: MarketEventType.SHORTAGE,
          name: 'Food Shortage',
          startTime: 0,
          duration: 1,
          intensity: 0.5,
          affectedTags: ['consumable', 'food'],
        } as MarketEvent],
      };

      // Item with single letter 'a' or words containing substrings (e.g. 'Gold locket with a painted portrait inside')
      const goldLocket: Item = {
        id: 'gold_locket',
        name: 'Gold locket with a painted portrait inside',
        description: 'A valuable locket.',
        type: ItemType.Treasure,
        costInGp: 100,
        weight: 1,
      };

      // Carpet containing 'x' in '3 ft. x 5 ft.'
      const flyingCarpet: Item = {
        id: 'carpet_flying',
        name: 'Carpet of Flying, 3 ft. x 5 ft.',
        description: 'A magic carpet.',
        type: ItemType.Treasure,
        costInGp: 500,
        weight: 10,
      };

      // Actual food item that SHOULD match
      const rations: Item = {
        id: 'rations',
        name: 'Rations',
        description: 'Dry food.',
        type: ItemType.FoodDrink,
        costInGp: 2,
        weight: 1,
      };

      const locketPrice = calculatePrice(goldLocket, foodShortageEconomy, 'buy');
      expect(locketPrice.multiplier).toBe(1.0);
      expect(locketPrice.finalPrice).toBe(100);

      const carpetPrice = calculatePrice(flyingCarpet, foodShortageEconomy, 'buy');
      expect(carpetPrice.multiplier).toBe(1.0);
      expect(carpetPrice.finalPrice).toBe(500);

      const rationsPrice = calculatePrice(rations, foodShortageEconomy, 'buy');
      expect(rationsPrice.multiplier).toBe(1.5); // Base 1.0 + 0.5
      expect(rationsPrice.finalPrice).toBe(3);
    });

    it('matches category and plural tags via whole token and alias maps', () => {
      const weaponSurplusEconomy: EconomyState = {
        ...economy,
        marketEvents: [{
          id: 'evt_weapon_surplus',
          type: MarketEventType.SURPLUS,
          name: 'Weapon Surplus',
          startTime: 0,
          duration: 1,
          intensity: 0.2,
          affectedTags: ['weapons'], // Plural tag
        } as MarketEvent],
      };

      const dagger: Item = {
        id: 'dagger',
        name: 'Dagger',
        description: 'A sharp blade.',
        type: ItemType.Weapon,
        costInGp: 10,
        weight: 1,
      };

      const price = calculatePrice(dagger, weaponSurplusEconomy, 'buy');
      expect(price.multiplier).toBeCloseTo(0.8); // 1.0 - 0.2
      expect(price.finalPrice).toBe(8);
    });
  });
});
