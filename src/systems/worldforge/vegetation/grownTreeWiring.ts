// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 26/08/2026, 14:24:45
 * Dependents: None (Orphan)
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * ============================================================================
 * GROWN TREE WIRING PIPELINE
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * This file connects all parts of the procedural tree system together into a single,
 * easy-to-use pipeline for the 3D game world. It takes terrain biomes (like forests,
 * deserts, or tundras), grows realistic trees tailored to those climates, splits tree
 * placements into distinct visual variants, and calculates the exact scale and height
 * for every individual tree drawn on screen.
 *
 * WHY IT EXISTS:
 * In traditional games, every tree of a given species has the exact same preset height
 * and shape regardless of whether it grew on a sunny meadow or a windswept mountain peak.
 * Aralia uses environment-biased tree genomes where every climate grows unique silhouettes,
 * and every variant within that climate has its own natural, measured height. This file
 * is the central wiring hub that ensures the 3D renderer and chunk loaders receive
 * correctly scaled, climate-specific tree instances without repetitive glue code.
 *
 * HOW IT CONNECTS:
 * - Called by: World3D vegetation renderers (such as VegetationTreeField.tsx) and ground chunk loaders.
 * - Calls into:
 *   - treeEnvironment.ts (to get climate conditions like wind, moisture, and temperature for each biome)
 *   - grownTreeMeshSource.ts (to generate branch and leaf geometry from botanical genome rules)
 *   - grownTreeVariants.ts (to cache and retrieve grown tree assets and their measured heights)
 *   - treeInstancePartition.ts (to group scattered tree positions by biome and variant)
 *   - treeBatching.ts (to combine tree instances across chunks into optimized GPU draw calls)
 * ============================================================================
 */

import {
  type TreeEnvironment,
  type TreeSiteInputs,
  environmentForBiome,
  biomeGrowsTrees,
  TREE_BIOME_KEYS,
} from './treeEnvironment';

import {
  type TreeGenome,
  type TreeTraits,
  type TreeMetrics,
  type GrownTree,
  drawGenome,
  traitsFor,
  growTree,
  growTreeVariants,
  GROWN_VARIANT_SEED_STRIDE,
} from './grownTreeMeshSource';

import {
  GROWN_VARIANTS_PER_BIOME,
  grownTreeVariantsFor,
  grownTreeFor,
  grownTreeGeometry,
  grownTreeHeightM,
  clearGrownTreeCache,
} from './grownTreeVariants';

import {
  type GrownTreeBucket,
  type GrownScatterBiomes,
  partitionGrownTreeInstances,
} from './treeInstancePartition';

import {
  type GrownTreeBatch,
  type TreeBatchInput,
  buildGrownTreeBatches,
  grownTreeBatchKey,
  maxGrownTreeBatches,
} from './treeBatching';

import type { TreeGeometryData } from './treeMeshGenerator';

// ============================================================================
// RE-EXPORTS FOR UNIFIED ACCESS
// ============================================================================
// Exposing all core types and functions so external systems can import everything
// related to the environment-biased tree pipeline from this single wiring hub.
// ============================================================================

export type {
  TreeEnvironment,
  TreeSiteInputs,
  TreeGenome,
  TreeTraits,
  TreeMetrics,
  GrownTree,
  GrownTreeBucket,
  GrownScatterBiomes,
  GrownTreeBatch,
  TreeBatchInput,
  TreeGeometryData,
};

export {
  environmentForBiome,
  biomeGrowsTrees,
  TREE_BIOME_KEYS,
  drawGenome,
  traitsFor,
  growTree,
  growTreeVariants,
  GROWN_VARIANT_SEED_STRIDE,
  GROWN_VARIANTS_PER_BIOME,
  grownTreeVariantsFor,
  grownTreeFor,
  grownTreeGeometry,
  grownTreeHeightM,
  clearGrownTreeCache,
  partitionGrownTreeInstances,
  buildGrownTreeBatches,
  grownTreeBatchKey,
  maxGrownTreeBatches,
};

// ============================================================================
// PER-VARIANT HEIGHT & SCALING UTILITIES
// ============================================================================
// These functions provide direct access to the unique botanical height of each
// tree variant within a biome, replacing legacy uniform constants with dynamic
// growth measurements.
// ============================================================================

/**
 * Returns the exact measured world-space height in metres for a specific tree variant in a biome.
 *
 * Each variant of a tree within a biome grows with its own random variations in branch levels,
 * slenderness, and crown spread. This function looks up the simulated height calculated during
 * procedural growth so that instanced meshes can be scaled accurately.
 *
 * @param biome The name of the biome (e.g. 'Taiga', 'Tropical rainforest', 'Hot desert')
 * @param variant The variant index (from 0 up to GROWN_VARIANTS_PER_BIOME - 1)
 * @returns The height of the tree in metres
 */
export function getVariantHeightMultiplier(biome: string, variant: number): number {
  // Look up the pre-measured physical height from the cached grown variant data
  return grownTreeHeightM(biome, variant);
}

/**
 * Applies per-variant botanical height scaling to an array of base scatter scales.
 *
 * When tree positions are scattered across a chunk, each tree receives a random base size factor
 * (e.g. 0.8 to 1.2 for saplings vs mature trees). This function multiplies each individual scale factor
 * by the variant's actual botanical height in metres, producing the final world-space scale buffer.
 *
 * @param biome The biome where these trees grow
 * @param variant The variant index of the trees
 * @param baseScales The initial per-tree scale multipliers from the scatter buffer
 * @returns A new Float32Array containing world-space scale multipliers for each tree
 */
export function resolveInstanceScalesForVariant(
  biome: string,
  variant: number,
  baseScales: ArrayLike<number>,
): Float32Array {
  // Get the physical height of this specific variant in metres
  const heightM = grownTreeHeightM(biome, variant);
  const count = baseScales.length;
  const result = new Float32Array(count);

  // Multiply each instance's individual scatter scale by the variant's measured height
  for (let i = 0; i < count; i++) {
    result[i] = baseScales[i] * heightM;
  }

  return result;
}

// ============================================================================
// HIGH-LEVEL SCATTER WIRING & BATCH ORCHESTRATION
// ============================================================================
// Functions to process full chunk collections into ready-to-render batches
// and manage GPU geometry collections.
// ============================================================================

/**
 * High-level orchestration function that takes raw vegetation scatter data from multiple
 * terrain chunks and builds fully partitioned, per-variant scaled batches for rendering.
 *
 * @param inputs Array of terrain chunk contributions containing scattered tree instances
 * @returns Array of GPU-ready instanced batches grouped by biome, variant, and shadow tier
 */
export function wireGrownTreeBatches(inputs: readonly TreeBatchInput[]): GrownTreeBatch[] {
  // Delegate to the optimized batch builder which partitions by biome and variant
  // and applies per-variant height scaling to every instance
  return buildGrownTreeBatches(inputs);
}

/**
 * Pre-populates and returns a geometry lookup map for all variants of the specified biomes.
 *
 * Useful during scene initialization or chunk loading to ensure all required 3D meshes
 * are loaded into memory before rendering begins.
 *
 * @param biomes List or set of biome names to prepare geometries for
 * @returns A map keyed by `${biome}|${variant}` containing unit-frame tree geometry data
 */
export function prepareGrownTreeGeometryMap(
  biomes: Iterable<string>,
): Map<string, TreeGeometryData> {
  const geometries = new Map<string, TreeGeometryData>();

  // Iterate over every requested biome
  for (const biome of biomes) {
    // Only process biomes that can support tree growth (skips water, glaciers, etc.)
    if (!biomeGrowsTrees(biome)) {
      continue;
    }

    // Grow or retrieve all variants for this climate
    for (let v = 0; v < GROWN_VARIANTS_PER_BIOME; v++) {
      const key = `${biome}|${v}`;
      geometries.set(key, grownTreeGeometry(biome, v));
    }
  }

  return geometries;
}
