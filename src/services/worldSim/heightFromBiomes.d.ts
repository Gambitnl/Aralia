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
/**
 * Derives a deterministic heightfield (length `cols * rows`, row-major) from per-cell biome ids.
 * Heights correlate with each biome's authored elevation band, plus seeded per-cell jitter.
 *
 * @param biomeIds Row-major biome id per cell (e.g. `'mountain_alpine'`, `'plains'`, `'ocean'`).
 * @param cols Grid width.
 * @param rows Grid height.
 * @param seed World seed — same seed yields identical heights.
 */
export declare function heightFromBiomes(biomeIds: string[], cols: number, rows: number, seed: number): number[];
