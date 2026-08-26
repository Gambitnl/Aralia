/**
 * This file provides formatting functions for numbers, currency, lists, and text labels.
 *
 * In a fantasy RPG, values like player gold, item weights, spell levels (1st, 2nd, 3rd),
 * chapter numbers (IV, IX), and item lists need to be displayed cleanly in the UI and logbook.
 * This module ensures consistent text formatting throughout the entire game.
 *
 * Called by: Character sheet, inventory panels, merchant screens, logbook, tooltips.
 * Depends on: Pure JavaScript standard math and string APIs.
 */

// ============================================================================
// Currency and Economy Formatting
// ============================================================================
// Converts raw coin amounts or coin breakdown objects into readable RPG denominations.
// ============================================================================

export interface CoinPurseInput {
  cp?: number;
  sp?: number;
  ep?: number;
  gp?: number;
  pp?: number;
}

/**
 * Formats a coin purse object into a clean, human-readable string.
 *
 * @example
 * formatCoinPurse({ gp: 15, sp: 4 }) // returns "15 gp, 4 sp"
 * formatCoinPurse({}) // returns "0 gp"
 *
 * @param purse - The coins breakdown object.
 * @returns Human-readable coin string.
 */
export function formatCoinPurse(purse: CoinPurseInput): string {
  const parts: string[] = [];

  if (purse.pp && purse.pp > 0) parts.push(`${purse.pp} pp`);
  if (purse.gp && purse.gp > 0) parts.push(`${purse.gp} gp`);
  if (purse.ep && purse.ep > 0) parts.push(`${purse.ep} ep`);
  if (purse.sp && purse.sp > 0) parts.push(`${purse.sp} sp`);
  if (purse.cp && purse.cp > 0) parts.push(`${purse.cp} cp`);

  if (parts.length === 0) {
    return '0 gp';
  }

  return parts.join(', ');
}

/**
 * Formats a simple gold piece amount with commas for thousands.
 *
 * @param gp - Total gold amount.
 * @returns Formatted string (e.g. "1,250 gp").
 */
export function formatGold(gp: number): string {
  if (isNaN(gp) || !isFinite(gp)) return '0 gp';
  const rounded = Math.floor(gp);
  return `${rounded.toLocaleString('en-US')} gp`;
}

// ============================================================================
// Number and Scale Formatting
// ============================================================================
// Abbreviates large numbers and formats percentages, weights, and ordinals.
// ============================================================================

/**
 * Formats large quantities into compact, abbreviated forms (e.g. 1.5k, 2.4M).
 *
 * @param value - The raw number to abbreviate.
 * @param decimals - Number of decimal places to include (default: 1).
 * @returns Compact number string.
 */
export function formatNumberCompact(value: number, decimals: number = 1): string {
  if (isNaN(value) || !isFinite(value)) return '0';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    const formatted = (abs / 1_000_000_000).toFixed(decimals).replace(/\.0+$/, '');
    return `${sign}${formatted}B`;
  }
  if (abs >= 1_000_000) {
    const formatted = (abs / 1_000_000).toFixed(decimals).replace(/\.0+$/, '');
    return `${sign}${formatted}M`;
  }
  if (abs >= 1_000) {
    const formatted = (abs / 1_000).toFixed(decimals).replace(/\.0+$/, '');
    return `${sign}${formatted}k`;
  }

  return `${sign}${abs}`;
}

/**
 * Converts an integer into an English ordinal representation (e.g. 1st, 2nd, 3rd, 4th, 21st).
 *
 * @param n - The integer number (e.g. spell level, rank, or turn number).
 * @returns The ordinal string.
 */
export function formatOrdinal(n: number): string {
  const intVal = Math.floor(n);
  const abs = Math.abs(intVal);
  const lastTwo = abs % 100;
  const lastOne = abs % 10;

  let suffix = 'th';
  if (lastTwo < 11 || lastTwo > 13) {
    if (lastOne === 1) suffix = 'st';
    else if (lastOne === 2) suffix = 'nd';
    else if (lastOne === 3) suffix = 'rd';
  }

  return `${intVal}${suffix}`;
}

/**
 * Formats a decimal ratio into a percentage string.
 *
 * @param ratio - Ratio from 0 to 1 (e.g. 0.85 -> "85%").
 * @param decimals - Decimal places to include (default: 0).
 * @returns Formatted percentage string.
 */
export function formatPercentage(ratio: number, decimals: number = 0): string {
  if (isNaN(ratio) || !isFinite(ratio)) return '0%';
  const pct = ratio * 100;
  const formatted = decimals > 0 ? pct.toFixed(decimals) : Math.round(pct).toString();
  return `${formatted}%`;
}

/**
 * Formats an item or character weight in pounds (lbs).
 *
 * @param weightLbs - The weight in pounds.
 * @returns Formatted weight string (e.g. "12.5 lbs" or "1 lb").
 */
export function formatWeight(weightLbs: number): string {
  if (isNaN(weightLbs) || !isFinite(weightLbs) || weightLbs <= 0) {
    return '0 lbs';
  }
  const clean = parseFloat(weightLbs.toFixed(2));
  return clean === 1 ? '1 lb' : `${clean} lbs`;
}

// ============================================================================
// Classical and Text Structure Formatting
// ============================================================================
// Formats Roman numerals and natural language joined lists with Oxford commas.
// ============================================================================

/**
 * Converts a positive integer (1 to 3999) into a Roman numeral string.
 *
 * @example
 * formatRomanNumeral(4) // returns "IV"
 * formatRomanNumeral(19) // returns "XIX"
 *
 * @param num - The positive integer.
 * @returns Roman numeral string, or empty string if out of range.
 */
export function formatRomanNumeral(num: number): string {
  const intVal = Math.floor(num);
  if (intVal <= 0 || intVal > 3999 || isNaN(intVal)) {
    return '';
  }

  const lookup: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];

  let remaining = intVal;
  let result = '';

  for (const [val, letter] of lookup) {
    while (remaining >= val) {
      result += letter;
      remaining -= val;
    }
  }

  return result;
}

/**
 * Formats an array of string items into a natural language sentence with an Oxford comma.
 *
 * @example
 * formatList(['sword']) // "sword"
 * formatList(['sword', 'shield']) // "sword and shield"
 * formatList(['sword', 'shield', 'potion']) // "sword, shield, and potion"
 *
 * @param items - List of strings to join.
 * @param conjunction - Word to join the last item with ('and' | 'or', default: 'and').
 * @returns Joined natural language string.
 */
export function formatList(items: string[], conjunction: 'and' | 'or' = 'and'): string {
  const filtered = items.filter(Boolean);
  if (filtered.length === 0) return '';
  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 2) return `${filtered[0]} ${conjunction} ${filtered[1]}`;

  const allExceptLast = filtered.slice(0, -1).join(', ');
  const last = filtered[filtered.length - 1];
  return `${allExceptLast}, ${conjunction} ${last}`;
}
