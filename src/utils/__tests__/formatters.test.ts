import { describe, it, expect } from 'vitest';
import {
  formatCoinPurse,
  formatGold,
  formatNumberCompact,
  formatOrdinal,
  formatPercentage,
  formatWeight,
  formatRomanNumeral,
  formatList,
} from '../core/formatters';

/**
 * This test suite verifies the text and number formatting utility functions.
 *
 * In an RPG, clear visual presentation of currency, weights, ranks, ordinals,
 * Roman chapter numbers, and item lists is critical for clean UI and user experience.
 *
 * Covers: utils/core/formatters.ts
 * Tests: Coin breakdowns, large number abbreviations, English ordinals,
 * Roman numerals, weight units, percentages, and Oxford-comma lists.
 */

// ============================================================================
// Currency and Economy Formatting Tests
// ============================================================================
// Tests verifying coin purse serialization and gold amounts.
// ============================================================================

describe('Formatters - Currency', () => {
  it('should format coin purses with multiple denominations', () => {
    expect(formatCoinPurse({ gp: 50, sp: 5, cp: 2 })).toBe('50 gp, 5 sp, 2 cp');
    expect(formatCoinPurse({ pp: 2, gp: 10 })).toBe('2 pp, 10 gp');
    expect(formatCoinPurse({ ep: 4, cp: 12 })).toBe('4 ep, 12 cp');
  });

  it('should return "0 gp" for empty or zero coin purses', () => {
    expect(formatCoinPurse({})).toBe('0 gp');
    expect(formatCoinPurse({ gp: 0, sp: 0 })).toBe('0 gp');
  });

  it('should format flat gold piece numbers with commas', () => {
    expect(formatGold(100)).toBe('100 gp');
    expect(formatGold(1250)).toBe('1,250 gp');
    expect(formatGold(1000000)).toBe('1,000,000 gp');
    expect(formatGold(NaN)).toBe('0 gp');
  });
});

// ============================================================================
// Number and Scale Formatting Tests
// ============================================================================
// Tests verifying compact numbers, percentages, ordinals, and weights.
// ============================================================================

describe('Formatters - Numbers and Units', () => {
  describe('formatNumberCompact', () => {
    it('should format numbers under 1000 without suffix', () => {
      expect(formatNumberCompact(500)).toBe('500');
      expect(formatNumberCompact(0)).toBe('0');
      expect(formatNumberCompact(-25)).toBe('-25');
    });

    it('should format thousands with "k"', () => {
      expect(formatNumberCompact(1500)).toBe('1.5k');
      expect(formatNumberCompact(25000)).toBe('25k');
      expect(formatNumberCompact(999999)).toBe('1000k');
    });

    it('should format millions with "M"', () => {
      expect(formatNumberCompact(2500000)).toBe('2.5M');
      expect(formatNumberCompact(10000000)).toBe('10M');
    });

    it('should format billions with "B"', () => {
      expect(formatNumberCompact(1200000000)).toBe('1.2B');
    });
  });

  describe('formatOrdinal', () => {
    it('should handle standard 1st, 2nd, 3rd suffixes', () => {
      expect(formatOrdinal(1)).toBe('1st');
      expect(formatOrdinal(2)).toBe('2nd');
      expect(formatOrdinal(3)).toBe('3rd');
      expect(formatOrdinal(4)).toBe('4th');
    });

    it('should handle teens correctly (11th, 12th, 13th)', () => {
      expect(formatOrdinal(11)).toBe('11th');
      expect(formatOrdinal(12)).toBe('12th');
      expect(formatOrdinal(13)).toBe('13th');
      expect(formatOrdinal(14)).toBe('14th');
    });

    it('should handle larger numbers (21st, 22nd, 103rd, 111th, 121st)', () => {
      expect(formatOrdinal(21)).toBe('21st');
      expect(formatOrdinal(22)).toBe('22nd');
      expect(formatOrdinal(23)).toBe('23rd');
      expect(formatOrdinal(103)).toBe('103rd');
      expect(formatOrdinal(111)).toBe('111th');
      expect(formatOrdinal(112)).toBe('112th');
      expect(formatOrdinal(121)).toBe('121st');
    });
  });

  describe('formatPercentage', () => {
    it('should format decimals to whole percentages by default', () => {
      expect(formatPercentage(0.5)).toBe('50%');
      expect(formatPercentage(1)).toBe('100%');
      expect(formatPercentage(0)).toBe('0%');
      expect(formatPercentage(0.756)).toBe('76%');
    });

    it('should support custom decimal places', () => {
      expect(formatPercentage(0.756, 1)).toBe('75.6%');
      expect(formatPercentage(0.12345, 2)).toBe('12.35%');
    });
  });

  describe('formatWeight', () => {
    it('should format singular and plural pound weights', () => {
      expect(formatWeight(1)).toBe('1 lb');
      expect(formatWeight(15)).toBe('15 lbs');
      expect(formatWeight(4.5)).toBe('4.5 lbs');
      expect(formatWeight(0)).toBe('0 lbs');
      expect(formatWeight(-5)).toBe('0 lbs');
    });
  });
});

// ============================================================================
// Classical and Text Structure Tests
// ============================================================================
// Tests for Roman numerals and natural language joined lists.
// ============================================================================

describe('Formatters - Text & Structures', () => {
  describe('formatRomanNumeral', () => {
    it('should convert standard integers to Roman numerals', () => {
      expect(formatRomanNumeral(1)).toBe('I');
      expect(formatRomanNumeral(4)).toBe('IV');
      expect(formatRomanNumeral(5)).toBe('V');
      expect(formatRomanNumeral(9)).toBe('IX');
      expect(formatRomanNumeral(14)).toBe('XIV');
      expect(formatRomanNumeral(40)).toBe('XL');
      expect(formatRomanNumeral(90)).toBe('XC');
      expect(formatRomanNumeral(1994)).toBe('MCMXCIV');
      expect(formatRomanNumeral(2026)).toBe('MMXXVI');
    });

    it('should return empty string for non-positive or out-of-range numbers', () => {
      expect(formatRomanNumeral(0)).toBe('');
      expect(formatRomanNumeral(-5)).toBe('');
      expect(formatRomanNumeral(4000)).toBe('');
      expect(formatRomanNumeral(NaN)).toBe('');
    });
  });

  describe('formatList', () => {
    it('should format empty and single item lists', () => {
      expect(formatList([])).toBe('');
      expect(formatList(['Longsword'])).toBe('Longsword');
    });

    it('should format two-item lists with conjunction', () => {
      expect(formatList(['Longsword', 'Shield'])).toBe('Longsword and Shield');
      expect(formatList(['Attack', 'Flee'], 'or')).toBe('Attack or Flee');
    });

    it('should format three or more items with Oxford comma', () => {
      expect(formatList(['Dagger', 'Rope', 'Torch'])).toBe('Dagger, Rope, and Torch');
      expect(formatList(['Fire', 'Cold', 'Lightning', 'Poison'], 'or')).toBe('Fire, Cold, Lightning, or Poison');
    });
  });
});
