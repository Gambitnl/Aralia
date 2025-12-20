import { describe, expect, it } from 'vitest';
import { calculatePrice, parseCost } from '../economyUtils';
import type { EconomyState, Item } from '../../types';

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
      marketFactors: { scarcity: [], surplus: [] },
      buyMultiplier: 1,
      sellMultiplier: 0.5,
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

      // 0.01 * 0.5 = 0.005 => 0.00 after flooring to CP.
      expect(calculatePrice(torch, economy, 'sell').finalPrice).toBe(0);
    });
  });
});

