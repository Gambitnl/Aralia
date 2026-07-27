/**
 * @file d3Shim.ts — local implementations of the d3 utilities the ported FMG
 * modules import. We deliberately do NOT depend on d3; each function below
 * reproduces the exact semantics of its d3 counterpart (d3-array v3 /
 * d3-polygon v3) because FMG's outputs depend on edge-case behavior such as
 * mean() ignoring null/undefined/NaN. See ./ATTRIBUTION.md.
 */
/** d3-array `ascending`: NaN-propagating three-way comparator. */
export declare function ascending(a: number, b: number): number;
/**
 * d3-array `mean`: averages valid values only. A value is valid when it is
 * not null/undefined and coerces to a non-NaN number. Returns undefined when
 * no valid values exist.
 */
export declare function mean(values: Iterable<number | null | undefined>): number | undefined;
/**
 * d3-array `min`: natural-order minimum ignoring null/undefined/NaN.
 * Returns undefined when no comparable values exist.
 */
export declare function min(values: Iterable<number | null | undefined>): number | undefined;
/**
 * d3-array `range(start?, stop, step?)`: arithmetic progression
 * [start, stop) of length max(0, ceil((stop - start) / step)).
 */
export declare function range(start: number, stop?: number, step?: number): number[];
/**
 * d3-array `leastIndex(values, compare)`: index of the least element per the
 * comparator, or -1 if the iterable contains no comparable values. Mirrors
 * the two-argument-comparator path of d3 (FMG only calls it that way).
 */
export declare function leastIndex(values: Iterable<number>, compare?: (a: number, b: number) => number): number;
/**
 * d3-array `sum`: sum of valid values. Mirrors d3's exact filter — a value
 * contributes only when `+value` is truthy (null/undefined/NaN/0 are all
 * skipped, 0 harmlessly so).
 */
export declare function sum(values: Iterable<number | null | undefined>): number;
/**
 * d3-random `randomNormal` (v3): normal deviate generator built with the
 * polar (Marsaglia) rejection method, including the cached-second-value
 * behavior and the `.source()` API. FMG's `gauss` calls
 * `randomNormal.source(() => Math.random())(mu, sigma)()`, creating a fresh
 * generator per call, so the uniform draw order from the seeded global
 * Math.random is exactly upstream's.
 */
export interface RandomNormal {
    (mu?: number, sigma?: number): () => number;
    source: (source: () => number) => RandomNormal;
}
export declare const randomNormal: RandomNormal;
/**
 * d3-polygon `polygonArea`: signed area of the polygon (positive for
 * counterclockwise winding in screen coordinates per d3's convention).
 */
export declare function polygonArea(polygon: ArrayLike<[number, number]>): number;
/**
 * d3-array `max`: comparison-based maximum ignoring null/undefined/NaN.
 * Returns undefined when no valid values exist.
 */
export declare function max(values: Iterable<number | null | undefined>): number | undefined;
/**
 * d3-array `median` = quantile(values, 0.5). d3 uses quickselect internally;
 * this full-sort implementation returns the identical value (the same two
 * order statistics are interpolated) and draws no RNG.
 */
export declare function median(values: Iterable<number | null | undefined>): number | undefined;
/**
 * d3-array `shuffler`: returns a Fisher-Yates shuffle bound to the given
 * random source. Verbatim algorithm — the draw count (exactly array.length)
 * and swap order are part of the seeded stream (colorUtils.getColors).
 */
export declare function shuffler(random: () => number): <T>(array: T[], i0?: number, i1?: number) => T[];
/**
 * d3-color `Rgb`: float channels (no rounding until formatting), brighter()
 * multiplies channels by (1/0.7)^k, formatHex/formatRgb clamp and round.
 */
export declare class Rgb {
    r: number;
    g: number;
    b: number;
    opacity: number;
    constructor(r: number, g: number, b: number, opacity?: number);
    brighter(k?: number): Rgb;
    darker(k?: number): Rgb;
    formatHex(): string;
    formatRgb(): string;
    toString(): string;
}
/**
 * d3-color `color(specifier)` — subset parser for the formats the ported FMG
 * code can produce/consume: #rgb, #rrggbb, #rrggbbaa, rgb(r, g, b) and
 * rgba(r, g, b, a). Named CSS colors / hsl strings are not used by the
 * generation path and return null.
 */
export declare function color(format: string): Rgb | null;
/**
 * d3-interpolate `interpolateRgb` (default gamma 1, "nogamma" channel
 * interpolators). Returns the standard rgb(...) string per step, exactly as
 * d3 does (FMG re-parses it via color()).
 */
export declare function interpolateRgb(start: string | Rgb, end: string | Rgb): (t: number) => string;
/**
 * d3-interpolate generic `interpolate(a, b)` — FMG only calls it with two
 * color strings (colorUtils.getMixedColor), for which d3 dispatches to
 * interpolateRgb. Other input kinds are intentionally unsupported.
 */
export declare function interpolate(a: string, b: string): (t: number) => string;
/**
 * d3-scale-chromatic `interpolateRainbow` — verbatim cubehelix rainbow
 * (the hue/saturation/lightness ramp and the wrap-around for t outside
 * [0, 1]).
 */
export declare function interpolateRainbow(t: number): string;
/**
 * d3-scale `scaleSequential(interpolator)` — FMG always uses the default
 * [0, 1] domain, where the scale is the identity over the interpolator.
 */
export declare function scaleSequential(interpolator: (t: number) => string): (x: number) => string;
export { quadtree, Quadtree } from "./utils/quadtree";
