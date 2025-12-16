
import { describe, it, expect } from 'vitest';
import { calculateItemPrice, generateLocalEconomy } from '../economyService';
import { Item, Location } from '../../types';
import { WorldEvent } from '../../types/economy';

const mockItem: Item = {
  id: 'test_sword',
  name: 'Test Sword',
  description: 'A sharp test object.',
  type: 'weapon',
  costInGp: 10,
  cost: '10 gp',
  category: 'martial_weapon'
};

const mockLocation: Location = {
  id: 'loc_mountains',
  name: 'Mountain Village',
  baseDescription: 'Rocky place.',
  exits: {},
  mapCoordinates: { x: 0, y: 0 },
  biomeId: 'mountains'
};

const mockEvent: WorldEvent = {
  id: 'evt_war',
  type: 'WAR',
  name: 'Civil War',
  description: 'War increases demand for weapons.',
  affectedLocations: ['mountains'],
  affectedItemCategories: ['weapon'],
  priceModifier: 1.5,
  duration: 10,
  startTime: 0
};

describe('economyService', () => {
  it('should calculate base price with no events or biome modifiers', () => {
    const context = {
      location: { ...mockLocation, biomeId: 'plains' },
      events: []
    };
    const price = calculateItemPrice(mockItem, context);
    expect(price).toBe(10);
  });

  it('should apply biome modifiers', () => {
    // Mountains make weapons cheaper (0.8x)
    const context = {
      location: mockLocation,
      events: []
    };
    const price = calculateItemPrice(mockItem, context);
    expect(price).toBe(8);
  });

  it('should apply event modifiers', () => {
    // War makes weapons more expensive (1.5x)
    // Combined with Mountain (0.8x): 10 * 0.8 * 1.5 = 12
    const context = {
      location: mockLocation,
      events: [mockEvent]
    };
    const price = calculateItemPrice(mockItem, context);
    expect(price).toBe(12);
  });

  it('should generate local economy state correctly', () => {
    const economy = generateLocalEconomy(mockLocation, [mockEvent]);

    // Mountains surplus: weapon, armor
    // War scarcity: weapon

    expect(economy.marketFactors.surplus).toContain('weapon');
    expect(economy.marketFactors.surplus).toContain('armor');
    expect(economy.marketFactors.scarcity).toContain('weapon');

    // Inflation due to war
    expect(economy.buyMultiplier).toBeGreaterThan(1.0);
  });
});
