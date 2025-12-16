/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/utils/__tests__/factionUtils.test.ts
 * Tests for faction utility functions.
 */

import { describe, it, expect } from 'vitest';
import { getReputationTier, calculateNewStanding, REPUTATION_THRESHOLDS } from '../factionUtils';

describe('factionUtils', () => {
  describe('getReputationTier', () => {
    it('should correctly identify NEUTRAL tier', () => {
      expect(getReputationTier(0)).toBe('NEUTRAL');
      expect(getReputationTier(9)).toBe('NEUTRAL');
      expect(getReputationTier(-9)).toBe('NEUTRAL');
    });

    it('should correctly identify FRIENDLY tier', () => {
      expect(getReputationTier(10)).toBe('FRIENDLY');
      expect(getReputationTier(39)).toBe('FRIENDLY');
    });

    it('should correctly identify REVERED tier', () => {
      expect(getReputationTier(80)).toBe('REVERED');
      expect(getReputationTier(100)).toBe('REVERED');
    });

    it('should correctly identify NEMESIS tier', () => {
      expect(getReputationTier(-100)).toBe('NEMESIS');
      expect(getReputationTier(-80)).toBe('NEMESIS');
    });
  });

  describe('calculateNewStanding', () => {
    it('should clamp values to 100', () => {
      expect(calculateNewStanding(90, 20)).toBe(100);
    });

    it('should clamp values to -100', () => {
      expect(calculateNewStanding(-90, -20)).toBe(-100);
    });

    it('should add positive values correctly', () => {
      expect(calculateNewStanding(10, 5)).toBe(15);
    });

    it('should subtract negative values correctly', () => {
      expect(calculateNewStanding(10, -5)).toBe(5);
    });
  });
});
