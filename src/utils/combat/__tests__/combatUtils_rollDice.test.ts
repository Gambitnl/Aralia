
import { describe, it, expect } from 'vitest';
import { rollDice } from '../../combat/combatUtils';

describe('combatUtils: rollDice', () => {
  it('returns 0 for empty or invalid input', () => {
    expect(rollDice('')).toBe(0);
    expect(rollDice('0')).toBe(0);
  });

  it('rolls single dice notation correctly', () => {
    // We cannot predict random numbers, but we can check ranges.
    // Use a loop to statistically verify or mock Math.random if needed.
    // For unit testing logic, checking range is often sufficient.
    const result = rollDice('1d1');
    expect(result).toBe(1);

    const rangeResult = rollDice('1d6');
    expect(rangeResult).toBeGreaterThanOrEqual(1);
    expect(rangeResult).toBeLessThanOrEqual(6);
  });

  it('rolls multiple dice groups correctly', () => {
    // 1d1 + 1d1 = 2
    expect(rollDice('1d1+1d1')).toBe(2);
    // 2d1 + 3d1 = 5
    expect(rollDice('2d1+3d1')).toBe(5);
  });

  it('handles flat modifiers', () => {
    expect(rollDice('5')).toBe(5);
    expect(rollDice('1d1+5')).toBe(6);
  });

  it('handles subtraction', () => {
    // 5 - 1 = 4
    expect(rollDice('5-1')).toBe(4);
    // 5 - 1d1 = 4
    expect(rollDice('5-1d1')).toBe(4);
    // 1d1 - 1d1 = 0
    expect(rollDice('1d1-1d1')).toBe(0);
  });

  it('handles whitespace gracefully', () => {
    expect(rollDice(' 1d1 +  5 ')).toBe(6);
    expect(rollDice('1 d 1')).toBe(1); // "1d1" after space removal
  });

  it('handles complex mixed formulas', () => {
    // 1d1 + 2 + 1d1 - 1 = 3
    expect(rollDice('1d1 + 2 + 1d1 - 1')).toBe(3);
  });

  it('handles invalid parts by ignoring or best-effort', () => {
    // "1d1 + abc" -> "1d1+abc" -> "1d1" matches, "abc" ignored.
    expect(rollDice('1d1 + abc')).toBe(1);
  });
});
