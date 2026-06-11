/**
 * @file utils/colorUtils.ts — ported from Azgaar's Fantasy-Map-Generator
 * (MIT). Upstream: .tmp/azgaar-src/src/utils/colorUtils.ts. See
 * ../ATTRIBUTION.md.
 *
 * Ported: C_12, getColors, getRandomColor, getMixedColor — the civilization
 * stages store these hex strings on cultures/states/religions/provinces.
 *
 * RNG NOTE: getColors draws exactly `count` randoms (d3 shuffler),
 * getRandomColor and getMixedColor draw exactly 1 each — all from the global
 * Math.random, i.e. the seeded stream. Draw counts must not change.
 *
 * Stripped (no RNG): toHEX (rgba-string conversion helper used by UI editors).
 */
import {
  color,
  interpolate,
  interpolateRainbow,
  range,
  type Rgb,
  scaleSequential,
  shuffler,
} from "../d3Shim";

/** Predefined set of 12 distinct colors */
export const C_12 = [
  "#dababf",
  "#fb8072",
  "#80b1d3",
  "#fdb462",
  "#b3de69",
  "#fccde5",
  "#c6b9c1",
  "#bc80bd",
  "#ccebc5",
  "#ffed6f",
  "#8dd3c7",
  "#eb8de7",
];

/**
 * Get an array of distinct colors
 * Uses shuffler with current Math.random to ensure seeded randomness works
 * @param {number} count - The count of colors to generate
 * @returns {string[]} - The array of HEX color strings
 */
export const getColors = (count: number): string[] => {
  const scaleRainbow = scaleSequential(interpolateRainbow);
  // Use shuffler() to create a shuffle function that uses the current Math.random
  const shuffle = shuffler(() => Math.random());
  const colors = shuffle(
    range(count).map((i) =>
      i < 12 ? C_12[i] : color(scaleRainbow((i - 12) / (count - 12)))?.formatHex(),
    ),
  );
  return colors.filter((c): c is string => typeof c === "string");
};

/**
 * Get a random color in HEX format
 * @returns {string} - The HEX color string
 */
export const getRandomColor = (): string => {
  const colorFromRainbow: Rgb = color(
    scaleSequential(interpolateRainbow)(Math.random()),
  ) as Rgb;
  return colorFromRainbow.formatHex();
};

/**
 * Get a mixed color by blending a given color with a random color
 * @param {string} color - The base color in HEX format
 * @param {number} mix - The mix ratio (0 to 1)
 * @param {number} bright - The brightness adjustment
 * @returns {string} - The mixed HEX color string
 */
export const getMixedColor = (
  colorToMix: string,
  mix = 0.2,
  bright = 0.3,
): string => {
  const c = colorToMix && colorToMix[0] === "#" ? colorToMix : getRandomColor(); // if provided color is not hex (e.g. harching), generate random one
  const mixedColor: Rgb = color(interpolate(c, getRandomColor())(mix)) as Rgb;
  return mixedColor.brighter(bright).formatHex();
};
