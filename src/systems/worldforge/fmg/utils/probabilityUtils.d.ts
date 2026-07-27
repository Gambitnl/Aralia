/**
 * Creates a random number between min and max (inclusive). If only one argument is provided, it will be considered as max and min will be 0. If no arguments are provided, it returns a random float between 0 and 1.
 * @param {number} min - minimum value
 * @param {number} max - maximum value
 * @return {number} random integer between min and max
 */
export declare const rand: (min?: number, max?: number) => number;
/**
 * Returns a boolean based on the given probability.
 * @param {number} probability - probability between 0 and 1
 * @return {boolean} true with the given probability
 */
export declare const P: (probability: number) => boolean;
/**
 * Returns true every n times.
 * @param {number} n - the interval
 * @return {function} function that takes the current index and returns true every n times
 */
export declare const each: (n: number) => (i: number) => boolean;
/**
 * Random Gaussian number generator
 * Uses randomNormal.source(Math.random) to ensure it uses the current PRNG
 * @param {number} expected - expected value
 * @param {number} deviation - standard deviation
 * @param {number} min - minimum value
 * @param {number} max - maximum value
 * @param {number} round - round value to n decimals
 * @return {number} random number
 */
export declare const gauss: (expected?: number, deviation?: number, min?: number, max?: number, round?: number) => number;
/**
 * Returns the integer part of a float plus one with the probability of the decimal part.
 * @param {number} float - the float number
 * @return {number} the resulting integer
 */
export declare const Pint: (float: number) => number;
/**
 * Returns a random element from an array.
 * @param {Array} array - the array to pick from
 * @return {any} a random element from the array
 */
export declare const ra: <T>(array: T[]) => T;
/**
 * Returns a random key from an object where values are weights.
 * @param {Object} object - object with keys and their weights
 * @return {string} a random key based on weights
 *
 * @example
 * const obj = { a: 1, b: 3, c: 6 };
 * const randomKey = rw(obj); // 'a' has 10% chance, 'b' has 30% chance, 'c' has 60% chance
 */
export declare const rw: (object: {
    [key: string]: number;
}) => string;
/**
 * Returns a random integer from min to max biased towards one end based on exponent distribution (the bigger ex the higher bias towards min).
 * @param {number} min - minimum value
 * @param {number} max - maximum value
 * @param {number} ex - exponent for bias
 * @return {number} biased random integer
 */
export declare const biased: (min: number, max: number, ex: number) => number;
/**
 * Get number from string in format "1-3" or "2" or "0.5"
 * @param {string} r - range string
 * @return {number} parsed number
 */
export declare const getNumberInRange: (r: string) => number;
/**
 * Generate a random seed string
 * @return {string} random seed
 */
export declare const generateSeed: () => string;
