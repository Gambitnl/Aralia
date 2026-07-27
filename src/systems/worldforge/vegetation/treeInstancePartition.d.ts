/**
 * @file treeInstancePartition.ts
 * @description Deterministically splits an existing VegetationScatter payload
 * (positions come from the chunk loaders — placement is NOT re-invented here)
 * into per-(species, variant) instance buckets for instanced tree rendering.
 *
 * Species selection: the scatter's per-instance palette color is authored by
 * biome in the chunk loaders, so we classify from it — dark greens read as
 * conifer country (taiga/highland), yellow-shifted dry palettes as scrub,
 * everything else broadleaf — then a positional hash mixes ~1 in 5 the other
 * way so forests are not monocultures. With no colors, hash-only mix.
 * Pure + deterministic from the scatter buffers alone.
 */
import type { TreeSpecies } from './treeMeshGenerator';
export interface TreeInstanceBucket {
    species: TreeSpecies;
    variant: number;
    /** Indices into the scatter arrays (instance i = positions[i*3..]). */
    instanceIndices: number[];
}
export declare function classifySpecies(r: number | undefined, g: number | undefined, b: number | undefined, mix: number): TreeSpecies;
/**
 * Partition scatter instances into per-(species, variant) buckets.
 * Bucket order is fixed: species in TREE_SPECIES order × variant ascending, so
 * the renderer's mesh list is stable across chunks. Empty buckets included.
 */
export declare function partitionTreeInstances(scatter: {
    positions: Float32Array;
    colors?: Float32Array;
}): TreeInstanceBucket[];
