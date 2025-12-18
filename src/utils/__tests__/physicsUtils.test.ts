
import { describe, it, expect } from 'vitest';
import {
  calculateFallDamage,
  calculateCarryingCapacity,
  calculatePushDragLiftCapacity,
  calculateLongJumpDistance,
  calculateHighJumpHeight,
  calculateThrowDistance
} from '../physicsUtils';

describe('physicsUtils', () => {
  describe('calculateFallDamage', () => {
    it('returns 0 damage for falls less than 10 feet', () => {
      expect(calculateFallDamage(0).dice).toBe(0);
      expect(calculateFallDamage(5).dice).toBe(0);
      expect(calculateFallDamage(9).dice).toBe(0);
    });

    it('returns 1d6 for 10-19 feet', () => {
      const result = calculateFallDamage(10);
      expect(result).toEqual({ dice: 1, sides: 6, type: 'Bludgeoning' });
      expect(calculateFallDamage(19).dice).toBe(1);
    });

    it('scales linearly (2d6 for 20ft)', () => {
      expect(calculateFallDamage(20).dice).toBe(2);
      expect(calculateFallDamage(50).dice).toBe(5);
    });

    it('caps at 20d6 (200 feet)', () => {
      expect(calculateFallDamage(200).dice).toBe(20);
      expect(calculateFallDamage(500).dice).toBe(20);
    });
  });

  describe('calculateCarryingCapacity', () => {
    it('calculates for medium creatures (Str * 15)', () => {
      expect(calculateCarryingCapacity(10)).toBe(150);
      expect(calculateCarryingCapacity(20)).toBe(300);
    });

    it('applies size multiplier', () => {
      // Large creature (x2)
      expect(calculateCarryingCapacity(10, 2)).toBe(300);
      // Tiny creature (x0.5)
      expect(calculateCarryingCapacity(10, 0.5)).toBe(75);
    });
  });

  describe('calculatePushDragLiftCapacity', () => {
    it('is double the carrying capacity', () => {
      expect(calculatePushDragLiftCapacity(10)).toBe(300);
      expect(calculatePushDragLiftCapacity(20)).toBe(600);
    });
  });

  describe('calculateLongJumpDistance', () => {
    it('uses full strength score with running start', () => {
      expect(calculateLongJumpDistance(10, true)).toBe(10);
      expect(calculateLongJumpDistance(20, true)).toBe(20);
    });

    it('halves distance without running start', () => {
      expect(calculateLongJumpDistance(10, false)).toBe(5);
      expect(calculateLongJumpDistance(15, false)).toBe(7); // Math.floor(7.5)
    });
  });

  describe('calculateHighJumpHeight', () => {
    it('calculates 3 + mod with running start', () => {
      // Str 10 (+0)
      expect(calculateHighJumpHeight(0, true)).toBe(3);
      // Str 20 (+5)
      expect(calculateHighJumpHeight(5, true)).toBe(8);
    });

    it('halves height without running start', () => {
      // 3 + 0 = 3 -> 1.5 -> 1
      expect(calculateHighJumpHeight(0, false)).toBe(1);
      // 3 + 5 = 8 -> 4
      expect(calculateHighJumpHeight(5, false)).toBe(4);
    });
  });

  describe('calculateThrowDistance', () => {
    it('calculates base distance (Str * 10)', () => {
      // 10 Str, 1 lb object
      expect(calculateThrowDistance(10, 1)).toBe(100);
    });

    it('applies weight penalty', () => {
      // 10 Str, 15 lbs (10 over 5 -> 1 step -> -5ft)
      // 100 - 5 = 95
      expect(calculateThrowDistance(10, 15)).toBe(95);

      // 10 Str, 25 lbs (20 over 5 -> 2 steps -> -10ft)
      // 100 - 10 = 90
      expect(calculateThrowDistance(10, 25)).toBe(90);
    });

    it('enforces minimum distance', () => {
      // Weak character (1 Str = 10ft base) throwing heavy object (25 lbs -> -10ft)
      // 10 - 10 = 0 -> min 5
      expect(calculateThrowDistance(1, 25)).toBe(5);
    });
  });
});
