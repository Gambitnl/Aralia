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
import {
  RANGE_MIN_H, RANGE_MIN_CELLS, PEAK_MIN_H, PEAKS_PER_RANGE_MAX,
  RANGE_WORD_BANKS, PEAK_NAME_FORMS, PASS_WORDS,
} from './mountainTunables';

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
export function clusterRangeCells(
  h: ArrayLike<number>,
  neighbors: (c: number) => number[],
  cellCount: number,
): RangeCluster[] {
  const visited = new Uint8Array(cellCount);
  const clusters: RangeCluster[] = [];

  for (let cell = 0; cell < cellCount; cell++) {
    if (visited[cell] || h[cell] < RANGE_MIN_H) continue;

    const cellIds: number[] = [];
    const queue = [cell];
    visited[cell] = 1;
    while (queue.length) {
      const current = queue.pop() as number;
      cellIds.push(current);
      for (const neighbor of neighbors(current)) {
        if (neighbor < 0 || neighbor >= cellCount) continue;
        if (visited[neighbor] || h[neighbor] < RANGE_MIN_H) continue;
        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }

    if (cellIds.length < RANGE_MIN_CELLS) continue; // hills, not a range
    cellIds.sort((a, b) => a - b);
    const coreCells = cellIds.filter((c) => h[c] >= PEAK_MIN_H);
    clusters.push({ id: clusters.length, cellIds, coreCells, seedCell: cellIds[0] });
  }

  return clusters;
}

/**
 * A range's named peaks: cluster cells with h >= PEAK_MIN_H that are STRICTLY
 * higher than ALL their neighbors (in-cluster or not) — a plateau of
 * equal-height cells has no peak. Sorted by h descending then cell id
 * ascending, capped at PEAKS_PER_RANGE_MAX (the highest survive).
 */
export function findPeaks(
  cluster: RangeCluster,
  h: ArrayLike<number>,
  neighbors: (c: number) => number[],
): number[] {
  const peaks: number[] = [];
  for (const cell of cluster.cellIds) {
    if (h[cell] < PEAK_MIN_H) continue;
    let strict = true;
    for (const neighbor of neighbors(cell)) {
      // Out-of-bounds neighbors read undefined; `undefined >= x` is false, so
      // map-edge cells are only judged against neighbors that exist.
      if (h[neighbor] >= h[cell]) { strict = false; break; }
    }
    if (strict) peaks.push(cell);
  }
  peaks.sort((a, b) => (h[b] - h[a]) || (a - b));
  return peaks.slice(0, PEAKS_PER_RANGE_MAX);
}

/**
 * Classify a cluster: volcanic when ANY cell hosts a volcano marker (the
 * mountain's story trumps its silhouette), highlands when nothing reaches the
 * core line (rolling plateau country), else a true range.
 */
export function rangeKindOf(
  cluster: RangeCluster,
  hasVolcanoCell: (c: number) => boolean,
): RangeKind {
  for (const cell of cluster.cellIds) {
    if (hasVolcanoCell(cell)) return 'volcanic';
  }
  return cluster.coreCells.length === 0 ? 'highlands' : 'range';
}

/**
 * Name a range: culture adjective + one word from the kind's bank, e.g.
 * "Elden Spine" / "Elden Downs" / "Elden Furnace".
 */
export function nameRange(
  kind: RangeKind,
  cultureAdjective: string,
  rng: SeededRandom,
): string {
  return `${cultureAdjective} ${rng.pick(RANGE_WORD_BANKS[kind])}`;
}

/**
 * Name a peak: the rng picks a FORM ("Mount {a}", "{a} Horn", ...) and the
 * culture adjective slots into its '{a}' token — "Mount Elden", "Elden Fang".
 */
export function namePeak(cultureAdjective: string, rng: SeededRandom): string {
  return rng.pick(PEAK_NAME_FORMS).replace('{a}', cultureAdjective);
}

/**
 * Name a pass from a stem (culture adjective or nearest-peak name):
 * "<stem> <Pass|Gap|Col|Saddle>", e.g. "Elden Horn Col".
 */
export function namePass(stem: string, rng: SeededRandom): string {
  return `${stem} ${rng.pick(PASS_WORDS)}`;
}
