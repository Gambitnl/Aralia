/**
 * @file mountainClusters.ts — pure range clustering, peak finding, kind
 * assignment, and naming.
 *
 * The atlas-time core of the mountains campaign (spec 2026-07-11-mountains-
 * design): flood-fill contiguous highland cells into ranges, find each
 * range's strict local-maximum peaks, classify range/highlands/volcanic, and
 * name ranges, peaks, and passes from a culture adjective plus word banks.
 *
 * World-preservation doctrine: every function here is PURE — no pack types,
 * no globals, and ALL randomness flows through the rng parameter, so callers
 * control the seeded stream and existing goldens stay byte-identical.
 */
import type { SeededRandom } from '@/utils/random';
/** Per-range character; drives naming, glyph flavor, and future encounter hooks. */
export type RangeKind = 'range' | 'highlands' | 'volcanic';
/** One contiguous run of highland cells (h >= RANGE_MIN_H). `coreCells` is
 * the h >= PEAK_MIN_H subset; `seedCell` is the lowest cell id; cluster ids
 * are contiguous from 0 in seedCell order. */
export interface RangeCluster {
    id: number;
    cellIds: number[];
    coreCells: number[];
    seedCell: number;
}
/**
 * Flood-fill contiguous highland cells (h >= RANGE_MIN_H — land is implied,
 * 50 > the 20 sea line) into range clusters, the forestClusters idiom: a
 * queue over `neighbors(cell)`, gated on the height threshold. Clusters
 * below RANGE_MIN_CELLS are dropped — anonymous hills, not ranges.
 * Deterministic: the scan ascends cell ids, so clusters come out ordered by
 * seedCell with sorted cellIds (and coreCells, a filtered subset).
 */
export declare function clusterRangeCells(h: ArrayLike<number>, neighbors: (c: number) => number[], cellCount: number): RangeCluster[];
/**
 * A range's named peaks: cluster cells with h >= PEAK_MIN_H that are STRICTLY
 * higher than ALL their neighbors (in-cluster or not) — a plateau of
 * equal-height cells has no peak. Sorted by h descending then cell id
 * ascending, capped at PEAKS_PER_RANGE_MAX (the highest survive).
 */
export declare function findPeaks(cluster: RangeCluster, h: ArrayLike<number>, neighbors: (c: number) => number[]): number[];
/**
 * Classify a cluster: volcanic when ANY cell hosts a volcano marker (the
 * mountain's story trumps its silhouette), highlands when nothing reaches the
 * core line (rolling plateau country), else a true range.
 */
export declare function rangeKindOf(cluster: RangeCluster, hasVolcanoCell: (c: number) => boolean): RangeKind;
/**
 * Name a range: culture adjective + one word from the kind's bank, e.g.
 * "Elden Spine" / "Elden Downs" / "Elden Furnace".
 */
export declare function nameRange(kind: RangeKind, cultureAdjective: string, rng: SeededRandom): string;
/**
 * Name a peak: the rng picks a FORM ("Mount {a}", "{a} Horn", ...) and the
 * culture adjective slots into its '{a}' token — "Mount Elden", "Elden Fang".
 */
export declare function namePeak(cultureAdjective: string, rng: SeededRandom): string;
/**
 * Name a pass from a stem (culture adjective or nearest-peak name):
 * "<stem> <Pass|Gap|Col|Saddle>", e.g. "Elden Horn Col".
 */
export declare function namePass(stem: string, rng: SeededRandom): string;
