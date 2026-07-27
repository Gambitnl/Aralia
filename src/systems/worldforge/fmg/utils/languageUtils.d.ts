/**
 * Check if character is a vowel
 * @param c - The character to check.
 * @returns True if the character is a vowel, false otherwise.
 */
export declare const isVowel: (c: string) => boolean;
/**
 * Remove trailing vowels from a string until it reaches a minimum length.
 * @param string - The input string.
 * @param minLength - The minimum length of the string after trimming (default is 3).
 * @returns The trimmed string.
 */
export declare const trimVowels: (string: string, minLength?: number) => string;
/**
 * Get adjective form of a noun based on predefined rules.
 * @param noun - The noun to be converted to an adjective.
 * @returns The adjective form of the noun.
 */
export declare const getAdjective: (nounToBeAdjective: string) => string;
/**
 * Generate an abbreviation for a given name, avoiding restricted codes.
 * @param name - The name to be abbreviated.
 * @param restricted - An array of restricted abbreviations to avoid (default is an empty array).
 * @returns The generated abbreviation.
 */
export declare const abbreviate: (name: string, restricted?: string[]) => string;
/**
 * Ordinal suffix: 1 -> "1st", 2 -> "2nd", 11 -> "11th". Verbatim port of
 * upstream src/utils/languageUtils.ts nth (added for Military regiment names).
 */
export declare const nth: (n: number) => string;
