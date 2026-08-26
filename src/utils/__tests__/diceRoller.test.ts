import { describe, it, expect, vi } from 'vitest';
import { addDice } from '../diceUtils';
import { rollDice, rollDamage, rollD20 } from '../../systems/dice/rollers';

/**
 * This test suite verifies the dice rolling and dice formula arithmetic utilities.
 *
 * In D&D 5e mechanics, dice formulas power weapon damage, spell effects, ability checks,
 * attack rolls, and saving throws. This suite tests formula parsing, critical hit doubling,
 * advantage/disadvantage resolution, minimum roll thresholds (Elemental Adept), and edge cases.
 *
 * Covers: diceUtils.ts, combat/combatUtils.ts (rollDice, rollDamage, rollD20)
 * Tests: Dice additions, deterministic RNG rolling, critical multiplier rules,
 * advantage/disadvantage logic, and malformed inputs.
 */

// ============================================================================
// Dice Addition and Combination Tests
// ============================================================================
// Verifies addDice string manipulation and size compatibility guards.
// ============================================================================

describe('addDice Utility', () => {
  it('should combine matching dice sizes accurately', () => {
    // 1d6 + 1d6 (multiplier 1) -> 2d6
    expect(addDice('1d6', '1d6', 1)).toBe('2d6');

    // 2d8 + (1d8 * 3) -> 5d8
    expect(addDice('2d8', '1d8', 3)).toBe('5d8');

    // 4d10 + (2d10 * 2) -> 8d10
    expect(addDice('4d10', '2d10', 2)).toBe('8d10');
  });

  it('should reject and return base dice if sizes do not match', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Cannot add 1d6 to 1d8
    const result = addDice('1d6', '1d8', 1);
    expect(result).toBe('1d6');
    expect(warnSpy).toHaveBeenCalledWith('Cannot add dice with different sizes');

    warnSpy.mockRestore();
  });

  it('should return base unchanged if either formula is invalid', () => {
    expect(addDice('invalid', '1d6', 1)).toBe('invalid');
    expect(addDice('1d6', 'invalid', 1)).toBe('1d6');
  });
});

// ============================================================================
// Dice Roll and Damage Calculation Tests
// ============================================================================
// Verifies rollDice and rollDamage parsing, RNG injection, and 5e critical rules.
// ============================================================================

describe('rollDice and rollDamage Mechanics', () => {
  it('should roll a single die predictably with deterministic RNG', () => {
    // RNG returning 0 -> roll = 1; returning 0.999 -> roll = 6 on d6
    const minRng = () => 0;
    const maxRng = () => 0.9999;

    expect(rollDamage('1d6', false, 1, minRng)).toBe(1);
    expect(rollDamage('1d6', false, 1, maxRng)).toBe(6);
  });

  it('should accurately calculate flat bonuses and penalties', () => {
    // Fixed roll of 4 on a d6: rng returning 0.5 -> floor(0.5 * 6) + 1 = 4
    const midRng = () => 0.5;

    // 1d6+3 -> 4 + 3 = 7
    expect(rollDamage('1d6+3', false, 1, midRng)).toBe(7);

    // 1d6-2 -> 4 - 2 = 2
    expect(rollDamage('1d6-2', false, 1, midRng)).toBe(2);
  });

  it('should handle complex multi-dice formulas with whitespace', () => {
    // Deterministic RNG returning 0.5 (always rolls 4 on d6, 5 on d8)
    const fixedRng = () => 0.5;

    // Formula: "1d8 + 1d6 + 5"
    // 1d8 (5) + 1d6 (4) + 5 = 14
    expect(rollDamage('1d8 + 1d6 + 5', false, 1, fixedRng)).toBe(14);
  });

  it('should double the NUMBER of dice on a critical hit, but not flat bonuses', () => {
    const fixedRng = () => 0.5; // rolls 4 on d6

    // Normal hit: 2d6+3 -> (4 + 4) + 3 = 11
    const normal = rollDamage('2d6+3', false, 1, fixedRng);
    expect(normal).toBe(11);

    // Critical hit: 4d6+3 -> (4 * 4) + 3 = 19
    const critical = rollDamage('2d6+3', true, 1, fixedRng);
    expect(critical).toBe(19);
  });

  it('should enforce minRoll minimum values for elemental feats', () => {
    // RNG returning 0 (would roll 1 on a d6)
    const lowRng = () => 0;

    // Standard minRoll = 1 -> rolls 1
    expect(rollDamage('1d6', false, 1, lowRng)).toBe(1);

    // Elemental Adept minRoll = 2 -> minimum die value is clamped to 2
    expect(rollDamage('1d6', false, 2, lowRng)).toBe(2);
  });

  it('should return 0 for empty or zero dice expressions', () => {
    expect(rollDamage('', false)).toBe(0);
    expect(rollDamage('0', false)).toBe(0);
  });
});

// ============================================================================
// D20 Advantage and Disadvantage Tests
// ============================================================================
// Verifies rollD20 picking the highest of 2 on advantage and lowest on disadvantage.
// ============================================================================

describe('rollD20 Advantage / Disadvantage', () => {
  it('should return single roll when neither advantage nor disadvantage is active', () => {
    // Returns 0.45 -> floor(0.45 * 20) + 1 = 10
    const rng = () => 0.45;
    expect(rollD20({ rng })).toBe(10);
  });

  it('should choose the highest roll when advantage is active', () => {
    // Sequence of two rolls: first 5, then 18
    const values = [0.2, 0.85]; // floor(0.2*20)+1=5, floor(0.85*20)+1=18
    let callCount = 0;
    const rng = () => values[callCount++];

    const result = rollD20({ advantage: true, rng });
    expect(result).toBe(18);
  });

  it('should choose the lowest roll when disadvantage is active', () => {
    // Sequence of two rolls: first 15, then 4
    const values = [0.7, 0.15]; // floor(0.7*20)+1=15, floor(0.15*20)+1=4
    let callCount = 0;
    const rng = () => values[callCount++];

    const result = rollD20({ disadvantage: true, rng });
    expect(result).toBe(4);
  });

  it('should cancel out when both advantage and disadvantage are present', () => {
    // Rolls 12
    const rng = () => 0.55;
    const result = rollD20({ advantage: true, disadvantage: true, rng });
    expect(result).toBe(12);
  });
});
