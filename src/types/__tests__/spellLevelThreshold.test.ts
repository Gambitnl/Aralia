/**
 * @file spellLevelThreshold.test.ts
 * Covers the shared spell level-threshold resolver used by both target counts
 * (resolveScalableNumber) and cantrip damage tiers (SpellCommandFactory).
 */
import { describe, it, expect } from 'vitest';
import {
  countLevelThresholdsReached,
  resolveByLevelThreshold,
  resolveScalableNumber,
} from '../spellTargeting';

describe('resolveByLevelThreshold', () => {
  const cantripTiers: Record<string, string> = {
    '1': '1d10',
    '5': '2d10',
    '11': '3d10',
    '17': '4d10',
  };

  it('returns the value of the highest threshold the level reaches', () => {
    expect(resolveByLevelThreshold(cantripTiers, 1)).toBe('1d10');
    expect(resolveByLevelThreshold(cantripTiers, 5)).toBe('2d10');
    expect(resolveByLevelThreshold(cantripTiers, 11)).toBe('3d10');
    expect(resolveByLevelThreshold(cantripTiers, 17)).toBe('4d10');
  });

  it('holds the previous tier between thresholds', () => {
    expect(resolveByLevelThreshold(cantripTiers, 4)).toBe('1d10');
    expect(resolveByLevelThreshold(cantripTiers, 10)).toBe('2d10');
    expect(resolveByLevelThreshold(cantripTiers, 16)).toBe('3d10');
    expect(resolveByLevelThreshold(cantripTiers, 20)).toBe('4d10');
  });

  it('returns undefined when the level reaches no threshold', () => {
    expect(resolveByLevelThreshold({ '5': 2 }, 1)).toBeUndefined();
    expect(resolveByLevelThreshold({}, 17)).toBeUndefined();
  });

  it('ignores non-numeric threshold keys', () => {
    expect(resolveByLevelThreshold({ '5': 'two', bogus: 'nope' }, 11)).toBe('two');
  });
});

describe('countLevelThresholdsReached', () => {
  it('counts the cantrip tiers reached at levels 1, 5, 11 and 17', () => {
    const tiers = [5, 11, 17];
    expect(countLevelThresholdsReached(tiers, 1)).toBe(0);
    expect(countLevelThresholdsReached(tiers, 5)).toBe(1);
    expect(countLevelThresholdsReached(tiers, 11)).toBe(2);
    expect(countLevelThresholdsReached(tiers, 17)).toBe(3);
  });
});

describe('resolveScalableNumber (built on the shared resolver)', () => {
  const scalable = {
    base: 1,
    scaling: {
      type: 'character_level' as const,
      thresholds: { '5': 2, '11': 3, '17': 4 },
    },
  };

  it('resolves threshold tables at levels 1, 5, 11 and 17', () => {
    expect(resolveScalableNumber(scalable, 1)).toBe(1);
    expect(resolveScalableNumber(scalable, 5)).toBe(2);
    expect(resolveScalableNumber(scalable, 11)).toBe(3);
    expect(resolveScalableNumber(scalable, 17)).toBe(4);
  });

  it('still handles fixed and unlimited counts', () => {
    expect(resolveScalableNumber(3, 17)).toBe(3);
    expect(resolveScalableNumber('unlimited', 1)).toBe(Number.POSITIVE_INFINITY);
    expect(resolveScalableNumber('any_number', 1)).toBe(Number.POSITIVE_INFINITY);
  });
});
