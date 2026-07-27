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
import { type ForestWordBankKey } from './forestTunables';
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
export declare function clusterForestCells(biome: ArrayLike<number>, neighbors: (c: number) => number[], cellCount: number): ForestCluster[];
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
export declare function assignForestKinds(clusters: ForestCluster[], ctx: ForestKindContext): Map<number, ForestKind>;
/**
 * Name a forest: culture adjective + one word from the requested bank, e.g.
 * "Elden Wildwood". The caller picks the bank — usually the forest's kind,
 * or 'taiga'/'jungle' to flavor ordinary forests by their dominant biome.
 */
export declare function nameForest(bankKey: ForestWordBankKey, cultureAdjective: string, rng: SeededRandom): string;
