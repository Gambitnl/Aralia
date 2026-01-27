import { describe, it, expect } from 'vitest';
// TODO(lint-intent): 'SeasonalEffect' is unused in this test; use it in the assertion path or remove it.
import { getSeasonalEffects, getForagingDC, SeasonalEffect as _SeasonalEffect, SEASONAL_CONFIG as _SEASONAL_CONFIG } from '../SeasonalSystem';
import { Season } from '../../../utils/core';

describe('SeasonalSystem', () => {
  // Helpers for creating dates in specific seasons (Year 351)
  const winterDate = new Date(Date.UTC(351, 0, 15)); // Jan 15
  const springDate = new Date(Date.UTC(351, 3, 15)); // Apr 15
  const summerDate = new Date(Date.UTC(351, 6, 15)); // Jul 15
  const autumnDate = new Date(Date.UTC(351, 9, 15)); // Oct 15

  describe('getSeasonalEffects', () => {
    it('returns correct effects for Winter', () => {
      const effects = getSeasonalEffects(winterDate);
      expect(effects.season).toBe(Season.Winter);
      expect(effects.travelCostMultiplier).toBe(1.5);
      expect(effects.elements).toContain('cold');
      expect(effects.resourceYield).toBe(0.5);
    });

    it('returns correct effects for Summer', () => {
      const effects = getSeasonalEffects(summerDate);
      expect(effects.season).toBe(Season.Summer);
      expect(effects.travelCostMultiplier).toBe(1.0);
      expect(effects.elements).toContain('heat');
    });

    it('returns correct effects for Autumn', () => {
      const effects = getSeasonalEffects(autumnDate);
      expect(effects.season).toBe(Season.Autumn);
      expect(effects.resourceScarcity).toBeLessThan(1.0); // Easier
      expect(effects.resourceYield).toBeGreaterThan(1.0); // Bountiful
    });

    it('returns correct effects for Spring', () => {
      const effects = getSeasonalEffects(springDate);
      expect(effects.season).toBe(Season.Spring);
      expect(effects.resourceYield).toBeGreaterThan(1.0);
    });
  });

  describe('getForagingDC', () => {
    const baseDC = 10;

    it('increases DC in Winter', () => {
      const dc = getForagingDC(baseDC, winterDate);
      // Base 10 * 1.5 (scarcity) + 2 (survival mod) = 17
      expect(dc).toBe(17);
    });

    it('decreases DC in Autumn', () => {
      const dc = getForagingDC(baseDC, autumnDate);
      // Base 10 * 0.8 (scarcity) + 0 = 8
      expect(dc).toBe(8);
    });

    it('slightly decreases DC in Spring', () => {
      const dc = getForagingDC(baseDC, springDate);
      // Base 10 * 0.9 (scarcity) + 0 = 9
      expect(dc).toBe(9);
    });

    it('keeps DC standard in Summer', () => {
      const dc = getForagingDC(baseDC, summerDate);
      // Base 10 * 1.0 + 0 = 10
      expect(dc).toBe(10);
    });
  });
});
