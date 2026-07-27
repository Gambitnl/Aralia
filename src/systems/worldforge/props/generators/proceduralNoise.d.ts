/**
 * @file proceduralNoise.ts — tiny owned, seeded 3D value-noise for prop
 * geometry displacement (rocks, bushes, ragged log ends).
 *
 * Why not PerlinNoise (src/utils/random/perlinNoise.ts)? That class is 2D and
 * carries a 512-entry permutation table per instance; prop generators need a
 * cheap 3D field that is a pure function of (seed, x, y, z) so that cached
 * geometry variants are byte-identical across runs. No new dependencies —
 * this is ~40 lines of hash + trilinear interpolation.
 */
/** Deterministic 32-bit hash of a lattice point + seed → [0, 1). */
export declare function hash3(seed: number, ix: number, iy: number, iz: number): number;
/** Seeded 3D value noise in [-1, 1]. Pure function of its arguments. */
export declare function valueNoise3(seed: number, x: number, y: number, z: number): number;
/** Fractal (octaved) value noise in roughly [-1, 1]. */
export declare function fbm3(seed: number, x: number, y: number, z: number, octaves: number, lacunarity?: number, gain?: number): number;
/** Tiny deterministic PRNG (mulberry32) for generator-local decisions. */
export declare function makeRng(seed: number): () => number;
