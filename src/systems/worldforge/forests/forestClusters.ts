/**
 * @file forestClusters.ts — pure forest clustering, kind assignment, naming.
 *
 * The atlas-time core of the forests campaign (spec 2026-07-11-forests-design):
 * flood-fill contiguous forest-biome cells into clusters, crown per-landmass
 * ancient forests, roll rare haunted/fey kinds, and name each forest from a
 * culture adjective plus a kind/flavor word bank.
 *
 * World-preservation doctrine: every function here is PURE — no pack types,
 * no globals, and ALL randomness flows through the rng parameter, so callers
 * control the seeded stream and existing goldens stay byte-identical.
 */
import type { SeededRandom } from '@/utils/random';
import {
  FOREST_BIOME_IDS, FOREST_MIN_CELLS, ANCIENT_MIN_CELLS,
  HAUNTED_PERCENT, FEY_PERCENT, HAUNTED_ISOLATION_WEIGHT,
  FOREST_WORD_BANKS, type ForestWordBankKey,
} from './forestTunables';

/** Per-forest character; drives naming, tint, encounter tables, nav DCs. */
export type ForestKind = 'ordinary' | 'ancient' | 'haunted' | 'fey';

/** One contiguous run of forest cells. `seedCell` is the lowest cell id in
 * the cluster; ids are contiguous from 0 in seedCell order. */
export interface ForestCluster {
  id: number;
  cellIds: number[];
  seedCell: number;
}

/**
 * Flood-fill contiguous forest-biome cells into clusters (the features.ts
 * markupPack idiom: a queue over `neighbors(cell)`, gated on membership).
 * Clusters below FOREST_MIN_CELLS are dropped — copses stay anonymous.
 * Deterministic: the scan ascends cell ids, so clusters come out ordered by
 * seedCell with sorted cellIds.
 */
export function clusterForestCells(
  biome: ArrayLike<number>,
  neighbors: (c: number) => number[],
  cellCount: number,
): ForestCluster[] {
  const visited = new Uint8Array(cellCount);
  const clusters: ForestCluster[] = [];

  for (let cell = 0; cell < cellCount; cell++) {
    if (visited[cell] || !FOREST_BIOME_IDS.has(biome[cell])) continue;

    const cellIds: number[] = [];
    const queue = [cell];
    visited[cell] = 1;
    while (queue.length) {
      const current = queue.pop() as number;
      cellIds.push(current);
      for (const neighbor of neighbors(current)) {
        if (neighbor < 0 || neighbor >= cellCount) continue;
        if (visited[neighbor] || !FOREST_BIOME_IDS.has(biome[neighbor])) continue;
        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }

    if (cellIds.length < FOREST_MIN_CELLS) continue; // a copse, not a forest
    cellIds.sort((a, b) => a - b);
    clusters.push({ id: clusters.length, cellIds, seedCell: cellIds[0] });
  }

  return clusters;
}

/** Caller-supplied world context for kind assignment — keeps this module free
 * of pack types. `rainforestShare` is the fraction of a cluster's cells in
 * rainforest biomes; `isolation` is 0..1 distance-from-burgs. */
export interface ForestKindContext {
  landmassOf: (cell: number) => number;
  rainforestShare: (c: ForestCluster) => number;
  isolation: (c: ForestCluster) => number;
  rng: SeededRandom;
}

/**
 * Assign every cluster a kind (keyed by cluster id):
 *
 * 1. ANCIENT — per landmass, among clusters with >= ANCIENT_MIN_CELLS cells,
 *    the one with the highest rainforestShare (tie: most cells, then lowest
 *    id) is crowned. At most one per landmass; no roll, no rng consumed.
 * 2. HAUNTED / FEY — every non-ancient cluster with >= FOREST_MIN_CELLS * 2
 *    cells rolls once, in id order (determinism): roll < hauntedBand is
 *    haunted (band doubles via HAUNTED_ISOLATION_WEIGHT when isolation >
 *    0.5); the next FEY_PERCENT of the range is fey; the rest is ordinary.
 * 3. Small clusters are ordinary without rolling.
 */
export function assignForestKinds(
  clusters: ForestCluster[],
  ctx: ForestKindContext,
): Map<number, ForestKind> {
  // Rule 1: crown at most one ancient forest per landmass.
  const candidatesByLandmass = new Map<number, ForestCluster[]>();
  for (const cluster of clusters) {
    if (cluster.cellIds.length < ANCIENT_MIN_CELLS) continue;
    const landmass = ctx.landmassOf(cluster.seedCell);
    const group = candidatesByLandmass.get(landmass);
    if (group) group.push(cluster);
    else candidatesByLandmass.set(landmass, [cluster]);
  }
  const ancientIds = new Set<number>();
  for (const group of candidatesByLandmass.values()) {
    let best = group[0];
    for (let i = 1; i < group.length; i++) {
      const challenger = group[i];
      const challengerShare = ctx.rainforestShare(challenger);
      const bestShare = ctx.rainforestShare(best);
      if (
        challengerShare > bestShare
        || (challengerShare === bestShare
          && (challenger.cellIds.length > best.cellIds.length
            || (challenger.cellIds.length === best.cellIds.length && challenger.id < best.id)))
      ) {
        best = challenger;
      }
    }
    ancientIds.add(best.id);
  }

  // Rules 2 + 3: seeded rolls in id order; small clusters skip the roll.
  const kinds = new Map<number, ForestKind>();
  const inIdOrder = [...clusters].sort((a, b) => a.id - b.id);
  for (const cluster of inIdOrder) {
    if (ancientIds.has(cluster.id)) {
      kinds.set(cluster.id, 'ancient');
      continue;
    }
    if (cluster.cellIds.length < FOREST_MIN_CELLS * 2) {
      kinds.set(cluster.id, 'ordinary');
      continue;
    }
    const roll = ctx.rng.nextInt(0, 100);
    const hauntedBand = HAUNTED_PERCENT
      * (ctx.isolation(cluster) > 0.5 ? HAUNTED_ISOLATION_WEIGHT : 1);
    kinds.set(
      cluster.id,
      roll < hauntedBand ? 'haunted'
        : roll < hauntedBand + FEY_PERCENT ? 'fey'
        : 'ordinary',
    );
  }
  return kinds;
}

/**
 * Name a forest: culture adjective + one word from the requested bank, e.g.
 * "Elden Wildwood". The caller picks the bank — usually the forest's kind,
 * or 'taiga'/'jungle' to flavor ordinary forests by their dominant biome.
 */
export function nameForest(
  bankKey: ForestWordBankKey,
  cultureAdjective: string,
  rng: SeededRandom,
): string {
  return `${cultureAdjective} ${rng.pick(FOREST_WORD_BANKS[bankKey])}`;
}
