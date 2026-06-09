/**
 * @file heightFromBiomes.ts
 * @description Deterministic biome→elevation heightfield derivation. Used by the migration
 * fallback path (worldsim-service WSS-004): when a world reaches generation with no Azgaar
 * terrain (legacy save, or legacy-generator fallback), we previously backfilled a constant
 * height of 30 — a featureless flat pancake in 3D. Instead we derive a real heightfield from
 * the per-cell biome ids so the world still has legible relief that correlates with biomes
 * (mountains sit high, oceans below sea level, plains just above the shore).
 *
 * Why this is built this way:
 * - Each biome carries an `elevation` band (`aquatic`/`low`/`mid`/`high`/`subterranean`); that
 *   band is the natural, already-authored signal for how high terrain should sit. We map each
 *   band to a base height (relative to `SEA_LEVEL = 20`, on the same 0–100 scale Azgaar uses)
 *   plus a small deterministic per-cell jitter so even single-biome regions get gentle relief
 *   without crossing into a neighbouring band.
 * - Jitter is drawn from a single `SeededRandom` walked in fixed cell order, so the same
 *   `(biomeIds, seed)` always yields byte-identical heights — required for save/replay
 *   reproducibility.
 *
 * Known limitations:
 * - This is intentionally coarse: it produces band-correlated relief, not Azgaar-fidelity
 *   terrain. The happy path (`generateAzgaarDerivedMap`) is still the source of real heightmaps.
 */

import { SeededRandom } from '@/utils/random';
import { BIOMES } from '@/data/biomes';
import type { Biome } from '@/types';

type ElevationBand = NonNullable<Biome['elevation']>;

/** Base height per elevation band, on the 0–100 scale (SEA_LEVEL = 20). */
const BAND_BASE: Record<ElevationBand, number> = {
  aquatic: 6, // below sea level → ocean/water
  subterranean: 24, // surface sits as low land above the cave/dungeon
  low: 26,
  mid: 46,
  high: 68,
};

/** Upward jitter range per band; kept narrow enough that bands never overlap. */
const BAND_JITTER: Record<ElevationBand, number> = {
  aquatic: 10, // 6..16, stays below SEA_LEVEL (20)
  subterranean: 6, // 24..30
  low: 12, // 26..38
  mid: 14, // 46..60
  high: 20, // 68..88
};

const DEFAULT_BAND: ElevationBand = 'low';
const SMOOTH_ITERATIONS = 1;
const SMOOTH_RELAX_WEIGHT = 2;

/** Salt mixed into the seed so this derivation does not correlate with placement RNG. */
const HEIGHT_SALT = 0x5eed1e55;

const clamp01to100 = (v: number): number => Math.max(0, Math.min(100, v));

function smoothHeightfield(heights: number[], cols: number, rows: number): number[] {
  const cells = cols * rows;
  let current = heights;
  let next = new Array<number>(cells);

  for (let pass = 0; pass < SMOOTH_ITERATIONS; pass++) {
    for (let i = 0; i < cells; i++) {
      const x = i % cols;
      const y = (i / cols) | 0;
      let sum = current[i];
      let count = 1;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) {
            continue;
          }
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) {
            continue;
          }
          sum += current[ny * cols + nx];
          count += 1;
        }
      }

      const neighborAverage = sum / count;
      next[i] = clamp01to100(
        Math.round((current[i] * (SMOOTH_RELAX_WEIGHT - 1) + neighborAverage) / SMOOTH_RELAX_WEIGHT),
      );
    }

    [current, next] = [next, current];
  }

  return current;
}

/**
 * Derives a deterministic heightfield (length `cols * rows`, row-major) from per-cell biome ids.
 * Heights correlate with each biome's authored elevation band, plus seeded per-cell jitter.
 *
 * @param biomeIds Row-major biome id per cell (e.g. `'mountain_alpine'`, `'plains'`, `'ocean'`).
 * @param cols Grid width.
 * @param rows Grid height.
 * @param seed World seed — same seed yields identical heights.
 */
export function heightFromBiomes(
  biomeIds: string[],
  cols: number,
  rows: number,
  seed: number,
): number[] {
  const cells = cols * rows;
  const rng = new SeededRandom((seed ^ HEIGHT_SALT) >>> 0);
  const heights = new Array<number>(cells);
  for (let i = 0; i < cells; i++) {
    const band = BIOMES[biomeIds[i]]?.elevation ?? DEFAULT_BAND;
    const base = BAND_BASE[band] ?? BAND_BASE[DEFAULT_BAND];
    const jitter = BAND_JITTER[band] ?? BAND_JITTER[DEFAULT_BAND];
    heights[i] = clamp01to100(Math.round(base + rng.next() * jitter));
  }

  return smoothHeightfield(heights, cols, rows);
}
