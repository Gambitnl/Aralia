/**
 * @file grownTreeVariants.ts — the world's grown-tree ASSET SET.
 *
 * WHAT THIS IS
 *
 * The preset path keeps one geometry per (species, variant) and instances it
 * everywhere. This is the same idea with the species axis replaced by the
 * BIOME axis: a handful of trees are grown per biome, once, and instanced.
 *
 * WHY BIOME AND NOT SPECIES
 *
 * A species is a preset by another name — a fixed silhouette that carries no
 * information about the place it stands in. `growTree` takes an ENVIRONMENT, so
 * the biome is the real input. `treeEnvironment.ts` turns a biome key into that
 * environment, and this file caches what grows out of it.
 *
 * PERFORMANCE
 *
 * Growth happens ONCE per (biome, variant), on first use, and the result is
 * held for the process. Nothing here runs per tree and nothing runs per frame.
 * A biome that no loaded chunk references is never grown.
 *
 * NO FALLBACK
 *
 * An unmapped biome throws out of `environmentForBiome`. This file does not
 * catch it. A quiet default here would be the preset fault one layer down.
 */
import { growTreeVariants, type GrownTree } from './grownTreeMeshSource';
import { environmentForBiome } from './treeEnvironment';
import type { TreeGeometryData } from './treeMeshGenerator';

/**
 * Variants grown per biome.
 *
 * Four, the same count the preset path uses per species, so the position hash
 * that picks a variant divides the same way and no tree moves between buckets
 * when the paths are compared.
 */
export const GROWN_VARIANTS_PER_BIOME = 4;

/**
 * World asset seed. Tree SHAPES are a global art set, exactly as they are on
 * the preset path; the per-place difference comes from the environment, not
 * from a per-world seed.
 */
const GROWN_TREE_SET_SEED = 1337;

/** Feet are canon in Worldforge; the scene is metres. */
const FEET_PER_METER = 3.28084;

/**
 * Per-biome seed offset. Without it two biomes with similar environments would
 * grow the SAME genome and differ only by trait bias, so neighbouring woods
 * would read as one wood shaded twice.
 */
function biomeSeed(biome: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < biome.length; i++) {
    h ^= biome.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (GROWN_TREE_SET_SEED + (h >>> 0)) >>> 0;
}

const CACHE = new Map<string, GrownTree[]>();

/** Every variant grown for one biome. Grown on first call, then held. */
export function grownTreeVariantsFor(biome: string): GrownTree[] {
  const hit = CACHE.get(biome);
  if (hit) return hit;
  // environmentForBiome THROWS on an unmapped biome, on purpose. Do not catch.
  const env = environmentForBiome(biome);
  const set = growTreeVariants(biomeSeed(biome), env, GROWN_VARIANTS_PER_BIOME);
  CACHE.set(biome, set);
  return set;
}

/** One grown tree: geometry in the unit frame, metrics in feet. */
export function grownTreeFor(biome: string, variant: number): GrownTree {
  const set = grownTreeVariantsFor(biome);
  const v = variant % GROWN_VARIANTS_PER_BIOME;
  return set[v];
}

/** Geometry only, for the instancer. */
export function grownTreeGeometry(biome: string, variant: number): TreeGeometryData {
  return grownTreeFor(biome, variant);
}

/**
 * The world height, in metres, this variant's unit-frame geometry scales to.
 *
 * This is the per-variant replacement for the preset path's `SPECIES_HEIGHT_M`
 * table. A grown tree MEASURES its own height while it grows, so a table of
 * authored heights would be a second, disagreeing answer. One batch is exactly
 * one (biome, variant), so this stays a per-batch constant — the batching
 * assumption is unchanged.
 */
export function grownTreeHeightM(biome: string, variant: number): number {
  return grownTreeFor(biome, variant).metrics.heightFt / FEET_PER_METER;
}

/** Drop the cache. Tests only — the game grows each biome once and keeps it. */
export function clearGrownTreeCache(): void {
  CACHE.clear();
}
