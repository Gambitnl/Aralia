// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/08/2026, 02:05:58
 * Dependents: components/World3D/WebGPUProbeScene.tsx, systems/worldforge/vegetation/treeBatching.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file treeInstancePartition.ts
 * @description Deterministically splits an existing VegetationScatter payload
 * (positions come from the chunk loaders — placement is NOT re-invented here)
 * into per-(species, variant) instance buckets for instanced tree rendering.
 *
 * TWO PARTITIONS LIVE HERE.
 *
 * `partitionTreeInstances` is the PRESET path. Species selection reads the
 * scatter's per-instance palette color, then a positional hash mixes ~1 in 5
 * the other way so forests are not monocultures.
 *
 * `partitionGrownTreeInstances` is the GROWN path. It reads the per-instance
 * BIOME the loaders now carry, and never looks at a color.
 *
 * WHY THE PALETTE WAS USED, AND WHY IT IS WRONG
 *
 * When the preset path was written the scatter carried positions, scales,
 * rotations and colors — and nothing that said where the tree stood. The
 * palette was the only per-instance channel with any authored meaning, so it
 * was read as a biome proxy.
 *
 * It never was one. In ground mode — the mode the game runs in — the palette
 * comes from a THREE-ENTRY green table picked by a hash of the feature id
 * (`buildGroundVegetation`), identical in every biome on the map. Classifying
 * from it therefore returns a fixed 3-way hash split, not a biome: a taiga and
 * a rainforest draw from the same three colors, and the deep-saturated third
 * entry resolves into the rainforest band, so palms grow on tundra.
 *
 * The fix is not a better color rule. It is to carry the biome, which the
 * loaders knew all along and threw away.
 *
 * Both partitions are pure and deterministic from the scatter buffers alone.
 */
import type { TreeSpecies } from './treeMeshGenerator';
import { VARIANTS_PER_SPECIES, TREE_SPECIES } from './treeMeshGenerator';
import { GROWN_VARIANTS_PER_BIOME } from './grownTreeVariants';

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

// ── The grown path ──────────────────────────────────────────────────────────

/** One (biome, variant) bucket of instances for the grown-tree renderer. */
export interface GrownTreeBucket {
  /** A `treeEnvironment` biome key — an FMG name or a ground biome id. */
  biome: string;
  variant: number;
  /** Indices into the scatter arrays (instance i = positions[i*3..]). */
  instanceIndices: number[];
}

/**
 * The per-instance biome channel a grown-tree scatter must carry.
 *
 * Codes rather than strings so the array survives a worker `postMessage` as a
 * typed array instead of one cloned string per tree.
 */
export interface GrownScatterBiomes {
  /** One code per instance; the code indexes `biomeTable`. */
  biomeCodes?: Uint8Array;
  /** Distinct biome keys this scatter references. */
  biomeTable?: readonly string[];
}

/**
 * Partition scatter instances into per-(biome, variant) buckets.
 *
 * Bucket order is fixed: `biomeTable` order x variant ascending, so the
 * renderer's mesh list is stable across rebuilds. Empty buckets are dropped —
 * unlike the preset path there is no fixed global biome list to enumerate, and
 * a chunk normally touches one or two biomes out of eleven.
 *
 * THROWS when the biome channel is missing. NO FALLBACK: a scatter with no
 * biome cannot grow a tree, and guessing one is the fault this path removes.
 */
export function partitionGrownTreeInstances(scatter: {
  positions: Float32Array;
} & GrownScatterBiomes): GrownTreeBucket[] {
  const count = scatter.positions.length / 3;
  if (count === 0) return [];
  const { biomeCodes, biomeTable } = scatter;
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
  for (const biome of biomeTable) {
    for (let v = 0; v < GROWN_VARIANTS_PER_BIOME; v++) {
      const bucket: GrownTreeBucket = { biome, variant: v, instanceIndices: [] };
      buckets.push(bucket);
      bucketIndex.set(`${biome}|${v}`, bucket);
    }
  }

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
    // Same salt and the same variant count as the preset path, so which
    // variant lands where is decided the same way in both.
    const variant = Math.min(
      GROWN_VARIANTS_PER_BIOME - 1,
      Math.floor(positionHash(x, z, 211) * GROWN_VARIANTS_PER_BIOME),
    );
    bucketIndex.get(`${biome}|${variant}`)!.instanceIndices.push(i);
  }
  return buckets.filter((b) => b.instanceIndices.length > 0);
}
