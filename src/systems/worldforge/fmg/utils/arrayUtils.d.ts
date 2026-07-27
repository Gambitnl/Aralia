/**
 * @file utils/arrayUtils.ts — ported from Azgaar's Fantasy-Map-Generator
 * (MIT). Upstream: .tmp/azgaar-src/src/utils/arrayUtils.ts. See
 * ../ATTRIBUTION.md. Logic preserved exactly; window globals and the unused
 * deepCopy helper removed.
 */
/**
 * Get the last element of an array
 * @param {Array} array - The array to get the last element from
 * @returns The last element of the array
 */
export declare const last: <T>(array: T[]) => T;
/**
 * Get unique elements from an array
 * @param {Array} array - The array to get unique elements from
 * @returns An array with unique elements
 */
export declare const unique: <T>(array: T[]) => T[];
/**
 * Get the appropriate typed array constructor based on the maximum value
 * @param {number} maxValue - The maximum value that will be stored in the array
 * @returns The typed array constructor
 */
export declare const getTypedArray: (maxValue: number) => Uint32ArrayConstructor | Uint8ArrayConstructor | Uint16ArrayConstructor;
/**
 * Create a typed array based on the maximum value and length or from an existing array
 * @param {Object} options - The options for creating the typed array
 * @param {number} options.maxValue - The maximum value that will be stored in the array
 * @param {number} options.length - The length of the typed array to create
 * @param {Array} [options.from] - An optional array to create the typed array from
 * @returns The created typed array
 */
export declare const createTypedArray: ({ maxValue, length, from, }: {
    maxValue: number;
    length?: number;
    from?: ArrayLike<number>;
}) => Uint8Array | Uint16Array | Uint32Array;
export declare const TYPED_ARRAY_MAX_VALUES: {
    INT8_MAX: number;
    UINT8_MAX: number;
    UINT16_MAX: number;
    UINT32_MAX: number;
};
