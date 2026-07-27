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
/**
 * Build a coherent value-noise field sampled by world feet. `cellSpanFt` is the
 * lattice node spacing (feet) — larger = smoother, lower-frequency detail.
 * Returns `(worldFx, worldFy) => number` in [0,1], a pure function of world
 * position (identical regardless of which cell asks).
 */
export declare function makeWorldFeetNoise(worldSeed: number, cellSpanFt: number): (fx: number, fy: number) => number;
