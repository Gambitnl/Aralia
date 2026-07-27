/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 27/02/2026, 09:33:27
 * Dependents: ProceduralScatter.tsx, perlinNoise.ts, random/index.ts, terrainUtils.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * Generates 2D Perlin noise for procedural generation.
 *
 * This implementation uses Ken Perlin's improved noise algorithm (though currently
 * implemented in 2D by slicing 3D gradients).
 *
 * @example
 * ```ts
 * const noise = new PerlinNoise(12345);
 * // Get noise value at coordinates. Coordinates should be scaled!
 * // Common scale: x * 0.1
 * const value = noise.get(x * scale, y * scale);
 * ```
 */
export declare class PerlinNoise {
    private permutation;
    constructor(seed: number);
    /**
     * Quintic interpolation curve: 6t^5 - 15t^4 + 10t^3.
     *
     * Used to smooth the transition between grid points. This curve has zero first
     * and second derivatives at t=0 and t=1, preventing artifacts (discontinuities)
     * in the resulting noise, which were present in the original cubic curve (3t^2 - 2t^3).
     */
    private fade;
    /**
     * Linear interpolation between a and b by weight t.
     */
    private lerp;
    /**
     * Calculates the dot product of a pseudorandom gradient vector and the input vector.
     *
     * @param hash - A value from the permutation table (0-255), determines the gradient direction.
     * @param x - X component of distance vector from the grid point.
     * @param y - Y component of distance vector from the grid point.
     * @param z - Z component of distance vector (unused in 2D calls, typically 0).
     *
     * @returns The dot product, representing the "influence" of the gradient at that point.
     *
     * Note: The bitwise logic selects a gradient vector from the 12 edges of a cube
     * (1,1,0), (-1,1,0), etc., without using a lookup table or expensive trigonometry.
     */
    private grad;
    /**
     * Calculates the noise value for 2D coordinates.
     *
     * @param x - The x coordinate.
     * @param y - The y coordinate.
     * @returns A noise value approximately in the range [-1.0, 1.0].
     *
     * Note: Inputs should typically be non-integer values (scaled down).
     * Calling with integers will return 0 because grid points have 0 influence.
     */
    get(x: number, y: number): number;
}
