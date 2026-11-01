/**
 * @file oceanFoamNoise.ts
 * The deterministic hashes, value noise and periodic cells used by sea foam.
 * These original functions and constants are shared by foam growth and fine lace.
 * Seeds, arithmetic and wrapping rules are unchanged; the old facade re-exports them.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 25/10/2026, 02:51:10
 * Dependents: systems/world3d/ocean/oceanFoamLace.ts, systems/world3d/ocean/oceanFoamMath.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/* ------------------------------------------------------------------ */
/* The lace texture, CPU mirror                                        */
/* ------------------------------------------------------------------ */

/**
 * TSL's `hash` (three/src/nodes/math/Hash.js, the PCG hash) on the CPU, bit
 * for bit: u32 arithmetic that wraps, then the float conversion WGSL does
 * (a u32 to f32 rounds to 24 bits), times 2^-32. The lace kernel hashes cell
 * indices with it, so the CPU can measure the lace's value distribution.
 */
export function pcgHash01(seed: number): number {
  const state = (Math.imul(seed >>> 0, 747796405) + 2891336453) >>> 0;
  const word = Math.imul(((state >>> ((state >>> 28) + 4)) ^ state) >>> 0, 277803737) >>> 0;
  const result = ((word >>> 22) ^ word) >>> 0;
  return Math.fround(result) * (1 / 2 ** 32);
}

/** The integer seed of a lace cell: the spatial hash the surface's glint cells use. */
export function foamCellSeed(ix: number, iz: number, salt: number): number {
  return (Math.imul(ix, 73856093) ^ Math.imul(iz, 19349663) ^ salt) | 0;
}




/**
 * How far a feature point may sit from its cell's center, as a fraction of
 * the cell. 0.9 makes the cells irregular in size and shape; at 0.8 and
 * without the warp (tried first) a single Worley layer read as reptile skin.
 */
export const FOAM_CELL_JITTER = 0.9;

/** Value noise in -1..1 on a lattice of `period` cells that wraps (a power of two). */
export function foamValueNoisePeriodic(px: number, pz: number, period: number, salt: number): number {
  const m = period - 1;
  const ix = Math.floor(px);
  const iz = Math.floor(pz);
  const fx = fade5(px - ix);
  const fz = fade5(pz - iz);
  const v = (x: number, z: number) => pcgHash01(foamCellSeed(x & m, z & m, salt)) * 2 - 1;
  const a = v(ix, iz); const b = v(ix + 1, iz);
  const c = v(ix, iz + 1); const d = v(ix + 1, iz + 1);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fz;
}

/**
 * One octave of the network on a lattice of `period` cells that wraps: the
 * Worley edge distance F2 - F1 at (px, pz), in cell units, over 0.6 and held
 * under 1. 0 on the line halfway between two feature points (a cell wall,
 * where the foam's filaments lie), 1 in the middle of a cell (a hole). The
 * tile kernel in oceanFoam.ts computes the same thing.
 */
export function foamCellEdgePeriodic(px: number, pz: number, period: number, salt: number): number {
  const m = period - 1;
  const ix = Math.floor(px);
  const iz = Math.floor(pz);
  const fx = px - ix;
  const fz = pz - iz;
  let f1 = 9;
  let f2 = 9;
  for (let dz = -1; dz <= 1; dz += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const s = foamCellSeed((ix + dx) & m, (iz + dz) & m, salt);
      const qx = dx + (1 - FOAM_CELL_JITTER) / 2 + FOAM_CELL_JITTER * pcgHash01(s) - fx;
      const qz = dz + (1 - FOAM_CELL_JITTER) / 2 + FOAM_CELL_JITTER * pcgHash01(s + 1) - fz;
      const d = Math.sqrt(qx * qx + qz * qz);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
  }
  return Math.min((f2 - f1) / 0.6, 1);
}

/** Quintic fade of value noise. */
function fade5(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Value noise in -1..1 on the unit lattice, from `pcgHash01` at the corners. */
export function foamValueNoise(px: number, pz: number, salt: number): number {
  const ix = Math.floor(px);
  const iz = Math.floor(pz);
  const fx = fade5(px - ix);
  const fz = fade5(pz - iz);
  const v = (x: number, z: number) => pcgHash01(foamCellSeed(x, z, salt)) * 2 - 1;
  const a = v(ix, iz); const b = v(ix + 1, iz);
  const c = v(ix, iz + 1); const d = v(ix + 1, iz + 1);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fz;
}
