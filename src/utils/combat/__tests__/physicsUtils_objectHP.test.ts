import { describe, it, expect } from 'vitest';
import {
  DicePool,
  averageDicePool,
  getObjectHP,
  getObjectHPAverage,
  calculateFallDamage,
} from '../physicsUtils';

/**
 * Object hit points are not damage, so `getObjectHP` returns a `DicePool` rather
 * than a `DiceRoll`. These tests pin that the formula carries no damage type and
 * that the published DMG p. 247 averages fall out of the same formula.
 */
const sizes = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'] as const;

describe('object hit points are decoupled from damage types', () => {
  it('never attaches a damage type to an object HP formula', () => {
    for (const size of sizes) {
      for (const isFragile of [false, true]) {
        const pool = getObjectHP(size, isFragile);
        expect(Object.keys(pool).sort()).toEqual(['dice', 'sides']);
        expect((pool as { type?: string }).type).toBeUndefined();
      }
    }
  });

  it('still attaches a damage type to falling damage, which IS damage', () => {
    expect(calculateFallDamage(30).type).toBe('bludgeoning');
  });

  it('keeps the DMG p. 247 dice for an unknown size', () => {
    const unknown = 'colossal' as (typeof sizes)[number];
    expect(getObjectHP(unknown)).toEqual({ dice: 1, sides: 4 });
  });
});

describe('averageDicePool', () => {
  it('rounds the arithmetic mean down, per D&D convention', () => {
    expect(averageDicePool({ dice: 4, sides: 8 })).toBe(18); // 4d8 = 18.0
    expect(averageDicePool({ dice: 5, sides: 10 })).toBe(27); // 5d10 = 27.5 -> 27
    expect(averageDicePool({ dice: 1, sides: 6 })).toBe(3); // 1d6 = 3.5 -> 3
  });

  it('adds a flat modifier when the pool carries one', () => {
    expect(averageDicePool({ dice: 1, sides: 8, modifier: 3 })).toBe(7); // 4.5 + 3 -> 7
  });

  it('never returns a negative total', () => {
    expect(averageDicePool({ dice: 1, sides: 4, modifier: -10 })).toBe(0);
  });
});

describe('getObjectHPAverage', () => {
  it('reproduces every published average in the DMG p. 247 table', () => {
    // [size, fragile, resilient] straight from the book.
    const table: Array<[(typeof sizes)[number], number, number]> = [
      ['tiny', 2, 5],
      ['small', 3, 10],
      ['medium', 4, 18],
      ['large', 5, 27],
    ];
    for (const [size, fragile, resilient] of table) {
      expect(getObjectHPAverage(size, true)).toBe(fragile);
      expect(getObjectHPAverage(size, false)).toBe(resilient);
    }
  });

  it('agrees with averaging the formula getObjectHP returns', () => {
    for (const size of sizes) {
      const pool: DicePool = getObjectHP(size);
      expect(getObjectHPAverage(size)).toBe(averageDicePool(pool));
    }
  });
});
