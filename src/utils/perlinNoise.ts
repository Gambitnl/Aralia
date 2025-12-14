/**
 * @file perlinNoise.ts
 * A simple implementation of Perlin noise for procedural generation.
 */
import { SeededRandom } from './seededRandom';

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
export class PerlinNoise {
  private permutation: number[] = [];

  constructor(seed: number) {
    const random = new SeededRandom(seed);
    const p: number[] = [];
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Shuffle p
    for (let i = p.length - 1; i > 0; i--) {
      const j = Math.floor(random.next() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }

    this.permutation = p.concat(p);
  }

  /**
   * Quintic interpolation curve: 6t^5 - 15t^4 + 10t^3.
   *
   * Used to smooth the transition between grid points. This curve has zero first
   * and second derivatives at t=0 and t=1, preventing artifacts (discontinuities)
   * in the resulting noise, which were present in the original cubic curve (3t^2 - 2t^3).
   */
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  /**
   * Linear interpolation between a and b by weight t.
   */
  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

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
  private grad(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15; // Take first 4 bits to get range 0-15
    const u = h < 8 ? x : y; // If h < 8, u is x, otherwise y
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z; // v is y, x, or z depending on bits
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v); // Add u and v with signs based on bits
  }

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
  public get(x: number, y: number): number {
    // Find unit cube that contains the point
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    
    // Find relative x,y of point in cube (0.0 - 1.0)
    x -= Math.floor(x);
    y -= Math.floor(y);

    // Compute fade curves for x, y
    const u = this.fade(x);
    const v = this.fade(y);

    // Hash coordinates of the 4 cube corners
    const p = this.permutation;
    const A = p[X] + Y;
    const B = p[X + 1] + Y;
    
    // Add blended results from 4 corners
    return this.lerp(v,
      this.lerp(u, this.grad(p[A], x, y, 0), this.grad(p[B], x - 1, y, 0)),
      this.lerp(u, this.grad(p[A + 1], x, y - 1, 0), this.grad(p[B + 1], x - 1, y - 1, 0))
    );
  }
}
