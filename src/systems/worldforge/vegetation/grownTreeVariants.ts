/**
 * ============================================================================
 * GROWN TREE ASSET CACHE & PER-VARIANT SCALING
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * This file manages the memory cache of procedurally grown 3D tree models for each biome
 * and provides their true physical heights (in metres) for rendering and instancing.
 *
 * WHY IT EXISTS:
 * Growing tree geometry through physics and botanical genome rules is computationally
 * intensive. Instead of growing trees per-chunk or per-frame, we grow a fixed set of
 * variants for each biome once on demand and cache them. This file also exposes the
 * measured height of each individual variant so that trees can be scaled accurately
 * in world space without hardcoded constants.
 *
 * HOW IT CONNECTS:
 * - Called by: treeBatching.ts, grownTreeWiring.ts, and VegetationTreeField.tsx.
 * - Calls into: grownTreeMeshSource.ts (growTreeVariants) and treeEnvironment.ts (environmentForBiome).
 * ============================================================================
 */

import { growTreeVariants, type GrownTree } from './grownTreeMeshSource';
import { environmentForBiome } from './treeEnvironment';
import type { TreeGeometryData } from './treeMeshGenerator';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

/**
 * The number of visual tree variants grown per biome.
 * Set to 4 to match the legacy preset path and allow position-hash consistency.
 */
export const GROWN_VARIANTS_PER_BIOME = 4;

/**
 * World asset seed. Tree shapes form a consistent art asset set across worlds;
 * variety comes from environmental climate response and local variant distribution.
 */
const GROWN_TREE_SET_SEED = 1337;

/** Conversion factor: feet are canon in Worldforge geometry, scene units are metres. */
const FEET_PER_METER = 3.28084;

// ============================================================================
// SEEDING & CACHING HELPERS
// ============================================================================

/**
 * Generates a stable numeric hash from a biome name to vary tree seeds across biomes.
 * Prevents adjacent biomes with similar weather from growing identical branches.
 */
function biomeSeed(biome: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < biome.length; i++) {
    h ^= biome.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (GROWN_TREE_SET_SEED + (h >>> 0)) >>> 0;
}

/** In-memory cache holding grown tree sets by biome name. */
const CACHE = new Map<string, GrownTree[]>();

// ============================================================================
// ASSET RETRIEVAL & HEIGHT LOOKUPS
// ============================================================================

/**
 * Retrieves all procedural tree variants for a given biome, growing and caching them if needed.
 *
 * @param biome The target biome name
 * @returns Array of GrownTree objects containing geometry, botanical traits, and metrics
 */
export function grownTreeVariantsFor(biome: string): GrownTree[] {
  const hit = CACHE.get(biome);
  if (hit) return hit;

  // environmentForBiome THROWS on an unmapped biome by design; do not catch
  const env = environmentForBiome(biome);
  const set = growTreeVariants(biomeSeed(biome), env, GROWN_VARIANTS_PER_BIOME);
  CACHE.set(biome, set);
  return set;
}

/**
 * Retrieves a single grown tree variant for a biome.
 *
 * @param biome Target biome name
 * @param variant Variant index (0 to GROWN_VARIANTS_PER_BIOME - 1)
 * @returns The full GrownTree object
 */
export function grownTreeFor(biome: string, variant: number): GrownTree {
  const set = grownTreeVariantsFor(biome);
  const v = variant % GROWN_VARIANTS_PER_BIOME;
  return set[v];
}

/**
 * Retrieves only the unit-frame geometry for a specific tree variant (for GPU buffer binding).
 *
 * @param biome Target biome name
 * @param variant Variant index
 * @returns TreeGeometryData (positions, normals, colors, indices)
 */
export function grownTreeGeometry(biome: string, variant: number): TreeGeometryData {
  return grownTreeFor(biome, variant);
}

/**
 * Returns the exact measured physical height in metres for a specific tree variant.
 *
 * Replaces legacy hardcoded species tables with the tree's actual simulated height
 * computed during procedural botanical growth.
 *
 * @param biome Target biome name
 * @param variant Variant index
 * @returns Tree height in metres
 */
export function grownTreeHeightM(biome: string, variant: number): number {
  return grownTreeFor(biome, variant).metrics.heightFt / FEET_PER_METER;
}

/**
 * Clears the grown tree geometry cache.
 * Intended primarily for automated tests to verify cold-start behavior.
 */
export function clearGrownTreeCache(): void {
  CACHE.clear();
}
