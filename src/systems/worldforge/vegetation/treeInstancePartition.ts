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
import { VARIANTS_PER_SPECIES, TREE_SPECIES } from './treeMeshGenerator';

export interface TreeInstanceBucket {
  species: TreeSpecies;
  variant: number;
  /** Indices into the scatter arrays (instance i = positions[i*3..]). */
  instanceIndices: number[];
}

function hash01(a: number, b: number, c: number): number {
  let h = Math.imul(a + 374761393, 668265263) ^ Math.imul(b + 1442695041, 1597334677) ^ (c | 0);
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0xffffffff;
}

/** Quantized-position hash: stable per world tree, no float-noise sensitivity. */
function positionHash(x: number, z: number, salt: number): number {
  return hash01(Math.round(x * 8), Math.round(z * 8), salt);
}

export function classifySpecies(
  r: number | undefined,
  g: number | undefined,
  b: number | undefined,
  mix: number,
): TreeSpecies {
  if (r === undefined || g === undefined || b === undefined) {
    // No palette: hash-only distribution 55% broadleaf / 35% conifer / 10% scrub.
    if (mix < 0.55) return 'broadleaf';
    if (mix < 0.9) return 'conifer';
    return 'scrub';
  }
  // Yellow-shifted (dry biome palette): scrub.
  if (r >= g * 0.85 && g >= b) return 'scrub';
  // Dark green (taiga/highland palette): conifer, with 20% broadleaf mix-in.
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  if (luminance < 0.24) return mix < 0.8 ? 'conifer' : 'broadleaf';
  // Temperate: broadleaf, with 20% conifer mix-in.
  return mix < 0.8 ? 'broadleaf' : 'conifer';
}

/**
 * Partition scatter instances into per-(species, variant) buckets.
 * Bucket order is fixed: species in TREE_SPECIES order × variant ascending, so
 * the renderer's mesh list is stable across chunks. Empty buckets included.
 */
export function partitionTreeInstances(scatter: {
  positions: Float32Array;
  colors?: Float32Array;
}): TreeInstanceBucket[] {
  const buckets: TreeInstanceBucket[] = [];
  const bucketIndex = new Map<string, TreeInstanceBucket>();
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
