/**
 * @file treeBatching.ts
 * @description Merges every loaded chunk's tree instances into ONE batch per
 * (species, variant, shadow tier), in world space.
 *
 * WHY: trees used to render one InstancedMesh per (species, variant) per CHUNK.
 * A live frame at burg Hajdured measured 2,340 trees spread across 379 instanced
 * meshes — about 6 trees each — and those 379 were 379 of the scene's 571 draw
 * calls. Instancing exists so a thousand copies cost about the same as one;
 * split that thin it stops paying for itself. Batching across chunks turns those
 * 379 meshes into at most `species × variants × 2` (24 today), whatever the
 * chunk count.
 *
 * The shadow tier is kept as a separate axis on purpose: only chunks adjacent to
 * the player contribute usable shadows, and one InstancedMesh has a single
 * castShadow flag, so near and far trees cannot share a batch without either
 * replaying the whole forest into the shadow pass or losing nearby shadows.
 *
 * Pure and deterministic: chunk order in, identical arrays out.
 */
import type { VegetationScatter } from '../../world3d/types';
import type { TreeSpecies } from './treeMeshGenerator';
import { SPECIES_HEIGHT_M, TREE_SPECIES, VARIANTS_PER_SPECIES } from './treeMeshGenerator';
import { partitionTreeInstances } from './treeInstancePartition';

/** One chunk's contribution: its scatter plus where that chunk sits in scene space. */
export interface TreeBatchInput {
  scatter: VegetationScatter;
  /** Chunk offset in scene units, added to every chunk-local position. */
  offset: readonly [number, number, number];
  /** Whether this chunk is close enough for its trees to cast shadows. */
  castShadow: boolean;
}

/** Flat, world-space instance data for one instanced draw. */
export interface TreeBatch {
  species: TreeSpecies;
  variant: number;
  castShadow: boolean;
  count: number;
  /** 3 floats per instance, scene space (chunk-local + chunk offset). */
  position: Float32Array;
  /** 1 float per instance: the final uniform scale, species height included. */
  scale: Float32Array;
  /** 1 float per instance: yaw in radians. */
  rotation: Float32Array;
  /** 3 floats per instance when any contributing chunk carried a palette. */
  color?: Float32Array;
}

/** Upper bound on batches, whatever the chunk count. */
export const MAX_TREE_BATCHES = TREE_SPECIES.length * VARIANTS_PER_SPECIES * 2;

interface Accumulator {
  species: TreeSpecies;
  variant: number;
  castShadow: boolean;
  position: number[];
  scale: number[];
  rotation: number[];
  color: number[];
  sawColor: boolean;
}

/**
 * Merge per-chunk scatters into world-space batches.
 *
 * Species/variant assignment is untouched — it still comes from
 * `partitionTreeInstances`, so which tree lands where does not change.
 */
export function buildTreeBatches(inputs: readonly TreeBatchInput[]): TreeBatch[] {
  // Fixed key order keeps the returned list stable across rebuilds, so React
  // reconciles the same meshes instead of tearing them down every chunk change.
  const accumulators = new Map<string, Accumulator>();
  const keyOf = (species: TreeSpecies, variant: number, castShadow: boolean) =>
    `${species}|${variant}|${castShadow ? 'near' : 'far'}`;

  for (const species of TREE_SPECIES) {
    for (let v = 0; v < VARIANTS_PER_SPECIES; v++) {
      for (const castShadow of [true, false]) {
        accumulators.set(keyOf(species, v, castShadow), {
          species, variant: v, castShadow,
          position: [], scale: [], rotation: [], color: [], sawColor: false,
        });
      }
    }
  }

  for (const input of inputs) {
    const { scatter, offset, castShadow } = input;
    const baseHeightBySpecies = SPECIES_HEIGHT_M;
    for (const bucket of partitionTreeInstances(scatter)) {
      if (bucket.instanceIndices.length === 0) continue;
      const acc = accumulators.get(keyOf(bucket.species, bucket.variant, castShadow));
      if (!acc) continue;
      const baseH = baseHeightBySpecies[bucket.species];
      for (const i of bucket.instanceIndices) {
        acc.position.push(
          scatter.positions[i * 3] + offset[0],
          scatter.positions[i * 3 + 1] + offset[1],
          scatter.positions[i * 3 + 2] + offset[2],
        );
        acc.scale.push(scatter.scales[i] * baseH);
        acc.rotation.push(scatter.rotations[i]);
        if (scatter.colors) {
          acc.sawColor = true;
          acc.color.push(scatter.colors[i * 3], scatter.colors[i * 3 + 1], scatter.colors[i * 3 + 2]);
        } else {
          // Hold the slot so color indices stay aligned with instance indices
          // even when only some chunks carry a palette.
          acc.color.push(0.35, 0.55, 0.3);
        }
      }
    }
  }

  const batches: TreeBatch[] = [];
  for (const acc of accumulators.values()) {
    const count = acc.scale.length;
    if (count === 0) continue;
    batches.push({
      species: acc.species,
      variant: acc.variant,
      castShadow: acc.castShadow,
      count,
      position: new Float32Array(acc.position),
      scale: new Float32Array(acc.scale),
      rotation: new Float32Array(acc.rotation),
      ...(acc.sawColor ? { color: new Float32Array(acc.color) } : {}),
    });
  }
  return batches;
}

/** Stable React key for a batch. */
export const treeBatchKey = (b: TreeBatch): string =>
  `${b.species}|${b.variant}|${b.castShadow ? 'near' : 'far'}`;
