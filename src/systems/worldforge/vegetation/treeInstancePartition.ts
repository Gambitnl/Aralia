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
    // No palette: hash-only spread across the temperate set.
    if (mix < 0.42) return 'broadleaf';
    if (mix < 0.68) return 'conifer';
    if (mix < 0.82) return 'ash';
    if (mix < 0.92) return 'aspen';
    return 'scrub';
  }
  /* Six species, not three (2026-08-04).
   *
   * Three meant a taiga, a temperate wood and a rainforest all drew from the
   * same silhouettes, so canopy tint was the only thing separating them and
   * every forest in the world read as the same forest in a different color.
   *
   * Each band still keeps a MINORITY companion species rather than resolving
   * to one: a pure stand is the monoculture read the position-hash mix exists
   * to break, and real woods are mixed almost everywhere.
   */
  // Yellow-shifted (dry biome palette): scrub, with the odd hardy conifer.
  if (r >= g * 0.85 && g >= b) return mix < 0.86 ? 'scrub' : 'conifer';

  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

  // Dark green (taiga/highland palette): conifer country, and the one place
  // aspen belongs — it is the cold-country pioneer that fills burns and edges.
  if (luminance < 0.24) {
    if (mix < 0.68) return 'conifer';
    if (mix < 0.9) return 'aspen';
    return 'broadleaf';
  }

  // Blue-shifted and bright (wet/lowland palette): ash is the streamside and
  // wetland tree, so it leads where the ground reads damp.
  if (b > r * 1.05) {
    if (mix < 0.55) return 'ash';
    if (mix < 0.85) return 'broadleaf';
    return 'aspen';
  }

  // Deep saturated green (rainforest palette): the only band that grows palm.
  if (g > 0.34 && g > r * 1.6) {
    if (mix < 0.5) return 'broadleaf';
    if (mix < 0.78) return 'palm';
    return 'ash';
  }

  // Temperate: broadleaf-led, mixed with conifer and ash.
  if (mix < 0.62) return 'broadleaf';
  if (mix < 0.84) return 'conifer';
  return 'ash';
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
