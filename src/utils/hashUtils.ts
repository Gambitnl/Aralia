/**
 * @file src/utils/hashUtils.ts
 * Shared hashing utilities.
 */

/**
 * Lightweight deterministic hash.
 * Adapted from submapUtils.ts for general usage.
 * Returns a positive integer.
 */
export const simpleHash = (input: string): number => {
    let h = 0;
    for (let i = 0; i < input.length; i++) {
        h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
};
