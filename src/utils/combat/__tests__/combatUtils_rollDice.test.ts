
import { describe, it, expect } from 'vitest';
import { rollDice, rollD20 } from '../../combat/combatUtils';

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

  it('supports deterministic RNG injection for dice rolls', () => {
    const values = [0.0, 0.999999, 0.5];
    let index = 0;
    const deterministicRng = () => values[index++] % 1;

    expect(rollDice('2d6', { rng: deterministicRng })).toBe(7);
    expect(index).toBe(2);
    expect(rollDice('1d1+3', { rng: deterministicRng })).toBe(4);
    expect(index).toBe(3);
  });

  it('supports deterministic RNG injection for d20 advantage/disadvantage', () => {
    const values = [0.2, 0.8, 0.1, 0.9];
    let index = 0;
    const deterministicRng = () => values[index++];

    expect(rollD20({ advantage: true, rng: deterministicRng })).toBe(17);
    expect(rollD20({ disadvantage: true, rng: deterministicRng })).toBe(3);
  });
});
