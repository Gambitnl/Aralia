/**
 * @file utils/numberUtils.ts — ported from Azgaar's Fantasy-Map-Generator
 * (MIT). Upstream: .tmp/azgaar-src/src/utils/numberUtils.ts. See
 * ../ATTRIBUTION.md. Logic preserved exactly; window globals removed.
 */
/**
 * Rounds a number to a specified number of decimal places.
 * @param v - The number to be rounded.
 * @param d - The number of decimal places to round to (default is 0).
 * @returns The rounded number.
 */
export declare const rn: (v: number, d?: number) => number;
/**
 * Clamps a number between a minimum and maximum value.
 * @param value - The number to be clamped.
 * @param min - The minimum value.
 * @param max - The maximum value.
 * @returns The clamped number.
 */
export declare const minmax: (value: number, min: number, max: number) => number;
/**
 * Clamps a number between 0 and 100.
 * @param v - The number to be clamped.
 * @returns The clamped number.
 */
export declare const lim: (v: number) => number;
/**
 * Normalizes a number within a specified range to a value between 0 and 1.
 * @param val - The number to be normalized.
 * @param min - The minimum value of the range.
 * @param max - The maximum value of the range.
 * @returns The normalized number.
 */
export declare const normalize: (val: number, min: number, max: number) => number;
/**
 * Performs linear interpolation between two values.
 * @param a - The starting value.
 * @param b - The ending value.
 * @param t - The interpolation factor (between 0 and 1).
 * @returns The interpolated value.
 */
export declare const lerp: (a: number, b: number, t: number) => number;
/**
 * Convert number to short string with SI postfix — verbatim port of upstream
 * src/utils/unitUtils.ts si (added for Military regiment totals).
 */
export declare const si: (n: number) => string;
