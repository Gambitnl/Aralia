/**
 * @file worldFeetNoise.ts — coherent value-noise indexed by WORLD position.
 *
 * Stage 5 / S5.2: the seam between two cells' Locales today comes from
 * `generateLocal`'s detail noise being seeded PER-LOCAL and indexed in each
 * Local's own cell frame (`makeLatticeNoise(streamPath(localPath,…))(cx,cy)`), so
 * the shared edge gets different detail from each side → a cliff.
 *
 * This is the fix: an INFINITE lattice whose node values are a deterministic hash
 * of `(worldSeed, latticeI, latticeJ)` and which is sampled by WORLD FEET. Because
 * it depends only on `(worldSeed, fx, fy)` — never on which cell/Local evaluates
 * it — two adjacent cells reading the same world point get the SAME value, so the
 * detail is continuous across cell boundaries BY CONSTRUCTION (zero stitching).
 * Smoothstep-interpolated for C1-ish continuity (no visible cliffs within a cell).
 *
 * Pure. No RNG state, no per-cell seeding, no grid.
 */

/** Deterministic [0,1) hash of an integer lattice node — the world-indexed seed. */
function hashNode(worldSeed: number, i: number, j: number): number {
  // Mix the seed with both lattice coords. `Math.imul` keeps it 32-bit and fast;
  // the final xorshift de-correlates adjacent nodes so the field looks random.
  let h = (worldSeed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ ((i | 0) + 0x7f4a7c15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ ((j | 0) + 0x165667b1), 0x27d4eb2f) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296; // 0..1
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/**
 * Build a coherent value-noise field sampled by world feet. `cellSpanFt` is the
 * lattice node spacing (feet) — larger = smoother, lower-frequency detail.
 * Returns `(worldFx, worldFy) => number` in [0,1], a pure function of world
 * position (identical regardless of which cell asks).
 */
export function makeWorldFeetNoise(worldSeed: number, cellSpanFt: number): (fx: number, fy: number) => number {
  const span = cellSpanFt || 1;
  return (fx: number, fy: number): number => {
    const gx = fx / span;
    const gy = fy / span;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = smooth(gx - x0);
    const ty = smooth(gy - y0);
    const n00 = hashNode(worldSeed, x0, y0);
    const n10 = hashNode(worldSeed, x0 + 1, y0);
    const n01 = hashNode(worldSeed, x0, y0 + 1);
    const n11 = hashNode(worldSeed, x0 + 1, y0 + 1);
    const a = n00 + (n10 - n00) * tx;
    const b = n01 + (n11 - n01) * tx;
    return a + (b - a) * ty;
  };
}
