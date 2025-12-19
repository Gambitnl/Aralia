
import { describe, it, expect } from 'vitest';
import {
  calculateFallDamage,
  calculateJumpDistance,
  calculateCarryingCapacity,
  calculateBreathDuration,
  calculateSuffocationRounds,
  calculateThrowDistance,
  getObjectAC,
  getObjectHP
} from '../physicsUtils';

describe('physicsUtils', () => {
  describe('getObjectAC', () => {
    it('returns correct AC for common materials', () => {
      expect(getObjectAC('cloth')).toBe(11);
      expect(getObjectAC('glass')).toBe(13);
      expect(getObjectAC('wood')).toBe(15);
      expect(getObjectAC('stone')).toBe(17);
      expect(getObjectAC('iron')).toBe(19);
      expect(getObjectAC('adamantine')).toBe(23);
    });

    it('handles fallback', () => {
      // @ts-ignore
      expect(getObjectAC('plastic')).toBe(10);
    });
  });

  describe('getObjectHP', () => {
    it('returns correct HP dice for sizes (Resilient)', () => {
      // Tiny Resilient -> 2d4
      expect(getObjectHP('tiny')).toEqual(expect.objectContaining({ dice: 2, sides: 4 }));
      // Small Resilient -> 3d6
      expect(getObjectHP('small')).toEqual(expect.objectContaining({ dice: 3, sides: 6 }));
      // Medium Resilient -> 4d8
      expect(getObjectHP('medium')).toEqual(expect.objectContaining({ dice: 4, sides: 8 }));
      // Large Resilient -> 5d10
      expect(getObjectHP('large')).toEqual(expect.objectContaining({ dice: 5, sides: 10 }));
    });

    it('returns correct HP dice for sizes (Fragile)', () => {
      // Tiny Fragile -> 1d4
      expect(getObjectHP('tiny', true)).toEqual(expect.objectContaining({ dice: 1, sides: 4 }));
      // Small Fragile -> 1d6
      expect(getObjectHP('small', true)).toEqual(expect.objectContaining({ dice: 1, sides: 6 }));
    });
  });

  describe('calculateFallDamage', () => {
    it('calculates 1d6 per 10 feet', () => {
      const result = calculateFallDamage(30);
      expect(result).toEqual({ dice: 3, sides: 6, type: 'bludgeoning' });
    });

    it('caps damage at 20d6 (200 feet)', () => {
      const result = calculateFallDamage(300);
      expect(result).toEqual({ dice: 20, sides: 6, type: 'bludgeoning' });
    });

    it('returns 0d6 for less than 10 feet', () => {
      const result = calculateFallDamage(9);
      expect(result.dice).toBe(0);
    });
  });

  describe('calculateJumpDistance', () => {
    it('calculates long jump based on Strength score', () => {
      // Str 16 -> 16 feet
      expect(calculateJumpDistance(16, 'long')).toBe(16);
    });

    it('calculates standing long jump as half', () => {
      // Str 16 -> 8 feet
      expect(calculateJumpDistance(16, 'long', true)).toBe(8);
    });

    it('calculates high jump as 3 + Str Mod', () => {
      // Str 16 (+3) -> 3 + 3 = 6 feet
      expect(calculateJumpDistance(16, 'high')).toBe(6);
    });

    it('calculates standing high jump as half', () => {
      // Str 16 (+3) -> 6 / 2 = 3 feet
      expect(calculateJumpDistance(16, 'high', true)).toBe(3);
    });

    it('handles low strength high jump gracefully', () => {
       // Str 1 (-5) -> 3 - 5 = -2 -> 0
       expect(calculateJumpDistance(1, 'high')).toBe(0);
    });
  });

  describe('calculateCarryingCapacity', () => {
    it('calculates capacity as Str * 15', () => {
      // Str 10 -> 150 lbs
      const result = calculateCarryingCapacity(10);
      expect(result.carryingCapacity).toBe(150);
      expect(result.pushDragLift).toBe(300);
    });

    it('applies size multiplier', () => {
      // Str 10, Large (2x) -> 300 lbs
      const result = calculateCarryingCapacity(10, 2);
      expect(result.carryingCapacity).toBe(300);
      expect(result.pushDragLift).toBe(600);
    });
  });

  describe('calculateBreathDuration', () => {
    it('calculates duration as 1 + Con Mod minutes', () => {
      // Con +2 -> 3 minutes
      expect(calculateBreathDuration(2)).toBe(3);
      // Con 0 -> 1 minute
      expect(calculateBreathDuration(0)).toBe(1);
    });

    it('enforces minimum of 30 seconds (0.5 minutes)', () => {
      // Con -2 -> 1 - 2 = -1 -> min 0.5
      expect(calculateBreathDuration(-2)).toBe(0.5);
      // Con -1 -> 1 - 1 = 0 -> min 0.5
      expect(calculateBreathDuration(-1)).toBe(0.5);
    });
  });

  describe('calculateSuffocationRounds', () => {
    it('calculates rounds equal to Con Mod', () => {
      // Con +3 -> 3 rounds
      expect(calculateSuffocationRounds(3)).toBe(3);
    });

    it('enforces minimum of 1 round', () => {
      // Con 0 -> min 1
      expect(calculateSuffocationRounds(0)).toBe(1);
      // Con -2 -> min 1
      expect(calculateSuffocationRounds(-2)).toBe(1);
    });
  });

  describe('calculateThrowDistance', () => {
    it('calculates base distance for light objects (Str * 10)', () => {
      // Str 10, 5 lbs -> 100 ft
      expect(calculateThrowDistance(10, 5)).toBe(100);
      // Str 15, 2 lbs -> 150 ft
      expect(calculateThrowDistance(15, 2)).toBe(150);
    });

    it('applies weight penalty for heavy objects', () => {
      // Str 10, 15 lbs
      // Excess = 15 - 5 = 10
      // Penalty = floor(10/10) * 5 = 5
      // Base = 100
      // Result = 95
      expect(calculateThrowDistance(10, 15)).toBe(95);

      // Str 10, 25 lbs
      // Excess = 20
      // Penalty = 2 * 5 = 10
      // Result = 90
      expect(calculateThrowDistance(10, 25)).toBe(90);
    });

    it('enforces minimum distance of 5 feet', () => {
      // Str 1 (Base 10), 100 lbs
      // Excess = 95
      // Penalty = 9 * 5 = 45
      // Result = 10 - 45 = -35 -> Min 5
      expect(calculateThrowDistance(1, 100)).toBe(5);
    });
  });
});
