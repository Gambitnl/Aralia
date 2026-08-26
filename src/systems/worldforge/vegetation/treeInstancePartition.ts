// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 26/08/2026
 * Dependents: components/World3D/WebGPUProbeScene.tsx, systems/worldforge/vegetation/treeBatching.ts, systems/worldforge/vegetation/grownTreeWiring.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * ============================================================================
 * TREE INSTANCE PARTITIONING
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * This file sorts thousands of scattered trees into organized groups (buckets) based on
 * what kind of tree they are and which visual variant they should use.
 *
 * WHY IT EXISTS:
 * When the world generates forests, terrain chunk loaders create lists of tree positions.
 * To draw all these trees efficiently using 3D hardware instancing, all trees sharing
 * the exact same 3D mesh must be grouped together into a single draw batch. This file
 * performs that grouping deterministically so trees never pop or change appearance.
 *
 * TWO PATHS LIVE HERE:
 * 1. Preset Path (`partitionTreeInstances`):
 *    The legacy approach that guessed a tree species from foliage colors and position hashes.
 * 2. Grown Path (`partitionGrownTreeInstances`):
 *    The modern environment-biased approach that reads the actual biome channel carried
 *    by the chunk loader, assigning true climate-tailored tree variants with per-variant
 *    height scaling.
 *
 * HOW IT CONNECTS:
 * - Called by: treeBatching.ts and grownTreeWiring.ts during chunk vegetation preparation.
 * - Calls into: grownTreeVariants.ts (for variant counts) and treeMeshGenerator.ts (for species).
 * ============================================================================
 */

import type { TreeSpecies } from './treeMeshGenerator';
import { VARIANTS_PER_SPECIES, TREE_SPECIES } from './treeMeshGenerator';
import { GROWN_VARIANTS_PER_BIOME } from './grownTreeVariants';

// ============================================================================
// TYPES & DATA STRUCTURES
// ============================================================================

/** One (species, variant) bucket of tree instance indices for preset rendering. */
export interface TreeInstanceBucket {
  /** The tree species category (e.g. broadleaf, conifer, scrub). */
  species: TreeSpecies;
  /** The specific model variation number within this species. */
  variant: number;
  /** Indices into the original scatter arrays (instance i = positions[i*3..]). */
  instanceIndices: number[];
}

/** One (biome, variant) bucket of tree instance indices for grown-tree rendering. */
export interface GrownTreeBucket {
  /** A biome key matching treeEnvironment (e.g. 'Taiga', 'jungle'). */
  biome: string;
  /** The specific model variation number grown for this biome. */
  variant: number;
  /** Indices into the original scatter arrays (instance i = positions[i*3..]). */
  instanceIndices: number[];
}

/**
 * The per-instance biome channel that chunk loaders attach to vegetation scatter data.
 * Uses compact numeric codes and a lookup table to minimize memory and worker transfer costs.
 */
export interface GrownScatterBiomes {
  /** One numeric biome index per instance; this code indexes `biomeTable`. */
  biomeCodes?: Uint8Array;
  /** Distinct biome names referenced across this chunk's scatter data. */
  biomeTable?: readonly string[];
}

// ============================================================================
// DETERMINISTIC HASHING HELPERS
// ============================================================================
// Math utilities that turn world coordinates into stable random numbers so that
// trees in the same location always pick the same species and variant.
// ============================================================================

/** 32-bit integer hash producing a normalized float between 0.0 and 1.0. */
function hash01(a: number, b: number, c: number): number {
  let h = Math.imul(a + 374761393, 668265263) ^ Math.imul(b + 1442695041, 1597334677) ^ (c | 0);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0xffffffff;
}

/** Quantized-position hash: stable per world tree, immune to floating-point noise. */
function positionHash(x: number, z: number, salt: number): number {
  // Quantize coordinates to 1/8th unit steps for stability across float boundaries
  return hash01(Math.round(x * 8), Math.round(z * 8), salt);
}

/**
 * Computes the stable procedural variant index for a grown tree at the given world coordinates.
 *
 * @param x World X coordinate of the tree
 * @param z World Z coordinate of the tree
 * @returns An integer variant index from 0 to GROWN_VARIANTS_PER_BIOME - 1
 */
export function getGrownVariantIndex(x: number, z: number): number {
  return Math.min(
    GROWN_VARIANTS_PER_BIOME - 1,
    Math.floor(positionHash(x, z, 211) * GROWN_VARIANTS_PER_BIOME),
  );
}

// ============================================================================
// LEGACY PRESET CLASSIFICATION & PARTITIONING
// ============================================================================
// Backward-compatible classification logic using vertex color heuristics.
// ============================================================================

/**
 * Guesses a tree species from scatter vertex colors and a position hash.
 *
 * @param r Red color channel (0..1)
 * @param g Green color channel (0..1)
 * @param b Blue color channel (0..1)
 * @param mix Random mix factor (0..1)
 * @returns The assigned TreeSpecies
 */
export function classifySpecies(
  r: number | undefined,
  g: number | undefined,
  b: number | undefined,
  mix: number,
): TreeSpecies {
  // If no palette is provided, fall back to a temperate mix based purely on position hash
  if (r === undefined || g === undefined || b === undefined) {
    if (mix < 0.42) return 'broadleaf';
    if (mix < 0.68) return 'conifer';
    if (mix < 0.82) return 'ash';
    if (mix < 0.92) return 'aspen';
    return 'scrub';
  }

  // Yellow-shifted palette (dry biome): scrub with occasional conifer
  if (r >= g * 0.85 && g >= b) {
    return mix < 0.86 ? 'scrub' : 'conifer';
  }

  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

  // Dark green palette (taiga/highland): conifer led with aspen pioneer
  if (luminance < 0.24) {
    if (mix < 0.68) return 'conifer';
    if (mix < 0.9) return 'aspen';
    return 'broadleaf';
  }

  // Blue-shifted and bright palette (wet/lowland): ash trees near streams
  if (b > r * 1.05) {
    if (mix < 0.55) return 'ash';
    if (mix < 0.85) return 'broadleaf';
    return 'aspen';
  }

  // Deep saturated green (rainforest): broadleaf and palm
  if (g > 0.34 && g > r * 1.6) {
    if (mix < 0.5) return 'broadleaf';
    if (mix < 0.78) return 'palm';
    return 'ash';
  }

  // Standard temperate baseline: broadleaf, conifer, and ash
  if (mix < 0.62) return 'broadleaf';
  if (mix < 0.84) return 'conifer';
  return 'ash';
}

/**
 * Partitions legacy preset scatter instances into per-(species, variant) buckets.
 *
 * @param scatter Chunk scatter object containing positions and optional colors
 * @returns Array of buckets ready for preset batching
 */
export function partitionTreeInstances(scatter: {
  positions: Float32Array;
  colors?: Float32Array;
}): TreeInstanceBucket[] {
  const buckets: TreeInstanceBucket[] = [];
  const bucketIndex = new Map<string, TreeInstanceBucket>();

  // Pre-seed all possible species and variant combinations
  for (const species of TREE_SPECIES) {
    for (let v = 0; v < VARIANTS_PER_SPECIES; v++) {
      const bucket: TreeInstanceBucket = { species, variant: v, instanceIndices: [] };
      buckets.push(bucket);
      bucketIndex.set(`${species}|${v}`, bucket);
    }
  }

  const count = scatter.positions.length / 3;
  for (let i = 0; i < count; i++) {
    const x = scatter.positions[i * 3];
    const z = scatter.positions[i * 3 + 2];
    const mix = positionHash(x, z, 101);
    const species = classifySpecies(
      scatter.colors?.[i * 3],
      scatter.colors?.[i * 3 + 1],
      scatter.colors?.[i * 3 + 2],
      mix,
    );
    const variant = Math.min(
      VARIANTS_PER_SPECIES - 1,
      Math.floor(positionHash(x, z, 211) * VARIANTS_PER_SPECIES),
    );
    bucketIndex.get(`${species}|${variant}`)!.instanceIndices.push(i);
  }

  return buckets;
}

// ============================================================================
// ENVIRONMENT-BIASED GROWN TREE PARTITIONING
// ============================================================================
// Groups instances by the true biome channel carried from world terrain data.
// ============================================================================

/**
 * Partition scatter instances into per-(biome, variant) buckets using true biome channels.
 *
 * Bucket order is stable: `biomeTable` order × variant ascending. Empty buckets are omitted
 * to avoid unnecessary render calls for absent biomes.
 *
 * Throws an error if the scatter is missing its biome data channel (no silent fallback).
 *
 * @param scatter Chunk scatter containing positions, biomeCodes, and biomeTable
 * @returns Array of populated GrownTreeBucket objects
 */
export function partitionGrownTreeInstances(scatter: {
  positions: Float32Array;
} & GrownScatterBiomes): GrownTreeBucket[] {
  const count = scatter.positions.length / 3;
  if (count === 0) return [];

  const { biomeCodes, biomeTable } = scatter;

  // Enforce strict safety invariant: grown trees require real biome data
  if (!biomeCodes || !biomeTable) {
    throw new Error(
      'partitionGrownTreeInstances: scatter carries no biome channel. '
      + 'The grown-tree path needs `biomeCodes` + `biomeTable` from the chunk '
      + 'loader; a scatter built before that channel existed must be rebuilt, '
      + 'not guessed at.',
    );
  }

  if (biomeCodes.length !== count) {
    throw new Error(
      `partitionGrownTreeInstances: ${biomeCodes.length} biome codes for `
      + `${count} instances — the loader wrote a mismatched channel.`,
    );
  }

  const buckets: GrownTreeBucket[] = [];
  const bucketIndex = new Map<string, GrownTreeBucket>();

  // Initialize bucket slots for every biome present in this chunk's table
  for (const biome of biomeTable) {
    for (let v = 0; v < GROWN_VARIANTS_PER_BIOME; v++) {
      const bucket: GrownTreeBucket = { biome, variant: v, instanceIndices: [] };
      buckets.push(bucket);
      bucketIndex.set(`${biome}|${v}`, bucket);
    }
  }

  // Assign each scattered tree instance to its corresponding (biome, variant) bucket
  for (let i = 0; i < count; i++) {
    const biome = biomeTable[biomeCodes[i]];
    if (biome === undefined) {
      throw new Error(
        `partitionGrownTreeInstances: instance ${i} has biome code `
        + `${biomeCodes[i]}, outside a table of ${biomeTable.length}.`,
      );
    }

    const x = scatter.positions[i * 3];
    const z = scatter.positions[i * 3 + 2];

    // Compute the deterministic variant index for this location
    const variant = getGrownVariantIndex(x, z);

    bucketIndex.get(`${biome}|${variant}`)!.instanceIndices.push(i);
  }

  // Filter out unused buckets so the renderer only receives active meshes
  return buckets.filter((b) => b.instanceIndices.length > 0);
}
