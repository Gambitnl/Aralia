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
export function hash3(seed: number, ix: number, iy: number, iz: number): number {
  let h = (seed | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ ix, 0x85ebca6b);
  h = Math.imul(h ^ iy, 0xc2b2ae35);
  h = Math.imul(h ^ iz, 0x27d4eb2f);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (t: number, a: number, b: number): number => a + t * (b - a);

/** Seeded 3D value noise in [-1, 1]. Pure function of its arguments. */
export function valueNoise3(seed: number, x: number, y: number, z: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fade(fx), v = fade(fy), w = fade(fz);
  const c000 = hash3(seed, ix, iy, iz);
  const c100 = hash3(seed, ix + 1, iy, iz);
  const c010 = hash3(seed, ix, iy + 1, iz);
  const c110 = hash3(seed, ix + 1, iy + 1, iz);
  const c001 = hash3(seed, ix, iy, iz + 1);
  const c101 = hash3(seed, ix + 1, iy, iz + 1);
  const c011 = hash3(seed, ix, iy + 1, iz + 1);
  const c111 = hash3(seed, ix + 1, iy + 1, iz + 1);
  const x00 = lerp(u, c000, c100);
  const x10 = lerp(u, c010, c110);
  const x01 = lerp(u, c001, c101);
  const x11 = lerp(u, c011, c111);
  const y0 = lerp(v, x00, x10);
  const y1 = lerp(v, x01, x11);
  return lerp(w, y0, y1) * 2 - 1;
}

/** Fractal (octaved) value noise in roughly [-1, 1]. */
export function fbm3(
  seed: number,
  x: number,
  y: number,
  z: number,
  octaves: number,
  lacunarity = 2.0,
  gain = 0.5,
): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise3(seed + o * 101, x * f, y * f, z * f);
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

/** Tiny deterministic PRNG (mulberry32) for generator-local decisions. */
export function makeRng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
