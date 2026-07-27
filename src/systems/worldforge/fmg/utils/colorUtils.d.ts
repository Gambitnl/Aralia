/** Predefined set of 12 distinct colors */
export declare const C_12: string[];
/**
 * Get an array of distinct colors
 * Uses shuffler with current Math.random to ensure seeded randomness works
 * @param {number} count - The count of colors to generate
 * @returns {string[]} - The array of HEX color strings
 */
export declare const getColors: (count: number) => string[];
/**
 * Get a random color in HEX format
 * @returns {string} - The HEX color string
 */
export declare const getRandomColor: () => string;
/**
 * Get a mixed color by blending a given color with a random color
 * @param {string} color - The base color in HEX format
 * @param {number} mix - The mix ratio (0 to 1)
 * @param {number} bright - The brightness adjustment
 * @returns {string} - The mixed HEX color string
 */
export declare const getMixedColor: (colorToMix: string, mix?: number, bright?: number) => string;
