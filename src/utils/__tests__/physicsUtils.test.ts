
import { describe, it, expect } from 'vitest';
import { calculateFallDamage, calculateJumpDistance, calculateCarryingCapacity } from '../physicsUtils';

describe('physicsUtils', () => {
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
});
