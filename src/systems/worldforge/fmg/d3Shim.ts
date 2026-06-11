/**
 * @file d3Shim.ts — local implementations of the d3 utilities the ported FMG
 * modules import. We deliberately do NOT depend on d3; each function below
 * reproduces the exact semantics of its d3 counterpart (d3-array v3 /
 * d3-polygon v3) because FMG's outputs depend on edge-case behavior such as
 * mean() ignoring null/undefined/NaN. See ./ATTRIBUTION.md.
 */

/** d3-array `ascending`: NaN-propagating three-way comparator. */
export function ascending(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}

/**
 * d3-array `mean`: averages valid values only. A value is valid when it is
 * not null/undefined and coerces to a non-NaN number. Returns undefined when
 * no valid values exist.
 */
export function mean(
  values: Iterable<number | null | undefined>,
): number | undefined {
  let count = 0;
  let sum = 0;
  for (let value of values) {
    if (value != null && (value = +value) >= value) {
      ++count;
      sum += value;
    }
  }
  if (count) return sum / count;
  return undefined;
}

/**
 * d3-array `min`: natural-order minimum ignoring null/undefined/NaN.
 * Returns undefined when no comparable values exist.
 */
export function min(
  values: Iterable<number | null | undefined>,
): number | undefined {
  let min: number | undefined;
  for (const value of values) {
    if (
      value != null &&
      ((min as number) > value || (min === undefined && value >= value))
    ) {
      min = value;
    }
  }
  return min;
}

/**
 * d3-array `range(start?, stop, step?)`: arithmetic progression
 * [start, stop) of length max(0, ceil((stop - start) / step)).
 */
export function range(start: number, stop?: number, step?: number): number[] {
  const n = arguments.length;
  start = +start;
  stop = +(stop as number);
  step =
    n < 2 ? ((stop = start), (start = 0), 1) : n < 3 ? 1 : +(step as number);

  let i = -1;
  const length = Math.max(0, Math.ceil((stop - start) / step)) | 0;
  const result = new Array<number>(length);
  while (++i < length) result[i] = start + i * step;
  return result;
}

/**
 * d3-array `leastIndex(values, compare)`: index of the least element per the
 * comparator, or -1 if the iterable contains no comparable values. Mirrors
 * the two-argument-comparator path of d3 (FMG only calls it that way).
 */
export function leastIndex(
  values: Iterable<number>,
  compare: (a: number, b: number) => number = ascending,
): number {
  let minValue: number | undefined;
  let min = -1;
  let index = -1;
  for (const value of values) {
    ++index;
    if (
      min < 0
        ? compare(value, value) === 0
        : compare(value, minValue as number) < 0
    ) {
      minValue = value;
      min = index;
    }
  }
  return min;
}

/**
 * d3-array `sum`: sum of valid values. Mirrors d3's exact filter — a value
 * contributes only when `+value` is truthy (null/undefined/NaN/0 are all
 * skipped, 0 harmlessly so).
 */
export function sum(values: Iterable<number | null | undefined>): number {
  let sum = 0;
  for (let value of values) {
    if ((value = +(value as number))) sum += value;
  }
  return sum;
}

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

export const randomNormal: RandomNormal = (function sourceRandomNormal(
  source: () => number,
): RandomNormal {
  function randomNormal(mu?: number, sigma?: number) {
    let x: number | null = null;
    let r = 0;
    const mean = mu == null ? 0 : +mu;
    const deviation = sigma == null ? 1 : +sigma;
    return function () {
      let y: number;

      // If available, use the second previously-generated uniform random.
      if (x != null) {
        y = x;
        x = null;
      }
      // Otherwise, generate a new x and y.
      else
        do {
          x = source() * 2 - 1;
          y = source() * 2 - 1;
          r = x * x + y * y;
        } while (!r || r > 1);

      return mean + deviation * y * Math.sqrt((-2 * Math.log(r)) / r);
    };
  }

  randomNormal.source = sourceRandomNormal;

  return randomNormal as RandomNormal;
})(Math.random);

/**
 * d3-polygon `polygonArea`: signed area of the polygon (positive for
 * counterclockwise winding in screen coordinates per d3's convention).
 */
export function polygonArea(polygon: ArrayLike<[number, number]>): number {
  let i = -1;
  const n = polygon.length;
  let a: [number, number];
  let b = polygon[n - 1];
  let area = 0;
  while (++i < n) {
    a = b;
    b = polygon[i];
    area += a[1] * b[0] - a[0] * b[1];
  }
  return area / 2;
}

/* ------------------------------------------------------------------------ *
 * Slice-3 additions (civilization layer). Same contract as above: exact
 * d3 v7-series semantics (d3-array 3.x, d3-color 3.x, d3-interpolate 3.x,
 * d3-scale-chromatic 3.x, d3-quadtree 3.x), no d3 dependency.
 * ------------------------------------------------------------------------ */

/**
 * d3-array `max`: comparison-based maximum ignoring null/undefined/NaN.
 * Returns undefined when no valid values exist.
 */
export function max(
  values: Iterable<number | null | undefined>,
): number | undefined {
  let maxValue: number | undefined;
  for (const value of values) {
    if (
      value != null &&
      (maxValue! < value || (maxValue === undefined && value >= value))
    ) {
      maxValue = value;
    }
  }
  return maxValue;
}

/**
 * d3-array `median` = quantile(values, 0.5). d3 uses quickselect internally;
 * this full-sort implementation returns the identical value (the same two
 * order statistics are interpolated) and draws no RNG.
 */
export function median(
  values: Iterable<number | null | undefined>,
): number | undefined {
  const numbers: number[] = [];
  for (let value of values) {
    if (value != null && (value = +value) >= value) numbers.push(value);
  }
  const n = numbers.length;
  if (!n) return undefined;
  numbers.sort(ascending);
  if (n < 2) return numbers[0];
  const i = (n - 1) * 0.5;
  const i0 = Math.floor(i);
  const value0 = numbers[i0];
  const value1 = numbers[i0 + 1];
  return value0 + (value1 - value0) * (i - i0);
}

/**
 * d3-array `shuffler`: returns a Fisher-Yates shuffle bound to the given
 * random source. Verbatim algorithm — the draw count (exactly array.length)
 * and swap order are part of the seeded stream (colorUtils.getColors).
 */
export function shuffler(random: () => number) {
  return function shuffle<T>(array: T[], i0 = 0, i1 = array.length): T[] {
    let m = i1 - (i0 = +i0);
    while (m) {
      const i = (random() * m--) | 0;
      const t = array[m + i0];
      array[m + i0] = array[i + i0];
      array[i + i0] = t;
    }
    return array;
  };
}

/* --------------------------- d3-color subset --------------------------- */

/** clamp helpers from d3-color v3 (rgb formatting). */
function clampi(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value) || 0));
}

function hexChannel(value: number): string {
  const v = clampi(value);
  return (v < 16 ? "0" : "") + v.toString(16);
}

const DARKER = 0.7;
const BRIGHTER = 1 / DARKER;

/**
 * d3-color `Rgb`: float channels (no rounding until formatting), brighter()
 * multiplies channels by (1/0.7)^k, formatHex/formatRgb clamp and round.
 */
export class Rgb {
  r: number;
  g: number;
  b: number;
  opacity: number;

  constructor(r: number, g: number, b: number, opacity = 1) {
    this.r = +r;
    this.g = +g;
    this.b = +b;
    this.opacity = +opacity;
  }

  brighter(k?: number): Rgb {
    const factor = k == null ? BRIGHTER : Math.pow(BRIGHTER, k);
    return new Rgb(
      this.r * factor,
      this.g * factor,
      this.b * factor,
      this.opacity,
    );
  }

  darker(k?: number): Rgb {
    const factor = k == null ? DARKER : Math.pow(DARKER, k);
    return new Rgb(
      this.r * factor,
      this.g * factor,
      this.b * factor,
      this.opacity,
    );
  }

  formatHex(): string {
    return `#${hexChannel(this.r)}${hexChannel(this.g)}${hexChannel(this.b)}`;
  }

  formatRgb(): string {
    const a = this.opacity;
    const alpha = isNaN(a) ? 1 : Math.max(0, Math.min(1, a));
    return (
      (alpha === 1 ? "rgb(" : "rgba(") +
      clampi(this.r) +
      ", " +
      clampi(this.g) +
      ", " +
      clampi(this.b) +
      (alpha === 1 ? ")" : `, ${alpha})`)
    );
  }

  toString(): string {
    return this.formatRgb();
  }
}

const reHex = /^#([0-9a-f]{3,8})$/;
const reRgbInteger =
  /^rgb\(\s*([+-]?\d+)\s*,\s*([+-]?\d+)\s*,\s*([+-]?\d+)\s*\)$/;
const reRgbaInteger =
  /^rgba\(\s*([+-]?\d+)\s*,\s*([+-]?\d+)\s*,\s*([+-]?\d+)\s*,\s*([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*\)$/;

function rgbn(n: number): Rgb {
  return new Rgb((n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 1);
}

/**
 * d3-color `color(specifier)` — subset parser for the formats the ported FMG
 * code can produce/consume: #rgb, #rrggbb, #rrggbbaa, rgb(r, g, b) and
 * rgba(r, g, b, a). Named CSS colors / hsl strings are not used by the
 * generation path and return null.
 */
export function color(format: string): Rgb | null {
  format = `${format}`.trim().toLowerCase();
  let m = reHex.exec(format);
  if (m) {
    const hex = m[1];
    const l = hex.length;
    const n = parseInt(hex, 16);
    if (l === 6) return rgbn(n); // #ff0000
    if (l === 3)
      return new Rgb(
        ((n >> 8) & 0xf) | ((n >> 4) & 0xf0),
        ((n >> 4) & 0xf) | (n & 0xf0),
        ((n & 0xf) << 4) | (n & 0xf),
        1,
      ); // #f00
    if (l === 8)
      return new Rgb(
        (n >> 24) & 0xff,
        (n >> 16) & 0xff,
        (n >> 8) & 0xff,
        (n & 0xff) / 0xff,
      ); // #ff000000
    return null;
  }
  m = reRgbInteger.exec(format);
  if (m) return new Rgb(+m[1], +m[2], +m[3], 1); // rgb(255, 0, 0)
  m = reRgbaInteger.exec(format);
  if (m) return new Rgb(+m[1], +m[2], +m[3], +m[4]); // rgba(255, 0, 0, 1)
  return null;
}

/* ------------------------ d3-interpolate subset ------------------------ */

/**
 * d3-interpolate `interpolateRgb` (default gamma 1, "nogamma" channel
 * interpolators). Returns the standard rgb(...) string per step, exactly as
 * d3 does (FMG re-parses it via color()).
 */
export function interpolateRgb(
  start: string | Rgb,
  end: string | Rgb,
): (t: number) => string {
  const s = typeof start === "string" ? (color(start) as Rgb) : start;
  const e = typeof end === "string" ? (color(end) as Rgb) : end;
  const nogamma = (a: number, b: number) => {
    const d = b - a;
    return d ? (t: number) => a + t * d : () => (isNaN(a) ? b : a);
  };
  const r = nogamma(s.r, e.r);
  const g = nogamma(s.g, e.g);
  const b = nogamma(s.b, e.b);
  const opacity = nogamma(s.opacity, e.opacity);
  return (t: number) => {
    const out = new Rgb(r(t), g(t), b(t), opacity(t));
    return out.toString();
  };
}

/**
 * d3-interpolate generic `interpolate(a, b)` — FMG only calls it with two
 * color strings (colorUtils.getMixedColor), for which d3 dispatches to
 * interpolateRgb. Other input kinds are intentionally unsupported.
 */
export function interpolate(a: string, b: string): (t: number) => string {
  return interpolateRgb(a, b);
}

/* --------------------- d3-scale-chromatic rainbow ---------------------- */

// Cubehelix -> RGB constants (d3-color cubehelix.js)
const CH_A = -0.14861;
const CH_B = +1.78277;
const CH_C = -0.29227;
const CH_D = -0.90649;
const CH_E = +1.97294;
const RADIANS = Math.PI / 180;

function cubehelixToRgbString(h: number, s: number, l: number): string {
  const hr = isNaN(h) ? 0 : (h + 120) * RADIANS;
  const a = isNaN(s) ? 0 : s * l * (1 - l);
  const cosh = Math.cos(hr);
  const sinh = Math.sin(hr);
  return new Rgb(
    255 * (l + a * (CH_A * cosh + CH_B * sinh)),
    255 * (l + a * (CH_C * cosh + CH_D * sinh)),
    255 * (l + a * (CH_E * cosh)),
    1,
  ).toString();
}

/**
 * d3-scale-chromatic `interpolateRainbow` — verbatim cubehelix rainbow
 * (the hue/saturation/lightness ramp and the wrap-around for t outside
 * [0, 1]).
 */
export function interpolateRainbow(t: number): string {
  if (t < 0 || t > 1) t -= Math.floor(t);
  const ts = Math.abs(t - 0.5);
  const h = 360 * t - 100;
  const s = 1.5 - 1.5 * ts;
  const l = 0.8 - 0.9 * ts;
  return cubehelixToRgbString(h, s, l);
}

/**
 * d3-scale `scaleSequential(interpolator)` — FMG always uses the default
 * [0, 1] domain, where the scale is the identity over the interpolator.
 */
export function scaleSequential(
  interpolator: (t: number) => string,
): (x: number) => string {
  return (x: number) => interpolator(x);
}

// d3-quadtree subset lives in ./utils/quadtree.ts (it is structural, not a
// numeric helper); re-exported here so ported modules can keep their
// `import { quadtree } from "d3"`-shaped imports pointed at the shim.
export { quadtree, Quadtree } from "./utils/quadtree";
