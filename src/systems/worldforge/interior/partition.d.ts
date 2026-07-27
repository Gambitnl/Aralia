/**
 * @file partition.ts — split a footprint into rooms on the 5 ft cell grid.
 *
 * Task 3 of the Building Blueprint Pipeline. BSP-splits the footprint's
 * bounding box, clips each leaf to the occupied cells, flood-fills each
 * leaf's occupied region into connected rooms (a leaf spanning a notch
 * yields two rooms), then merges slivers (< 3 cells) into the neighbor
 * they share the most edge with. With `keepMainWhole`, the largest fully
 * occupied rectangle (the main wing) — capped at roughly 30-45% of the
 * total area so it stays dominant without starving the rest of the floor
 * of rooms — is reserved as ONE un-split room so the hall/common-room/nave
 * stays dominant.
 *
 * Deterministic: all randomness derives from the 'partition' stream of the
 * given seed path. Pure data — no three.js, no rendering concerns.
 */
import type { Footprint } from './footprint';
import type { BuildingType } from './blueprintTypes';
import { type SeedPath } from '../seedPath';
/** Hard ceiling on room count for a building type (merge-down cap). */
export declare function roomCapFor(type: BuildingType): number;
/**
 * Partition a footprint into rooms. Returns rg[y][x]: room id per cell,
 * -1 outside the footprint; ids compact from 0.
 *
 * `maxRooms` (optional, additive) is a hard ceiling on the final room count:
 * a merge-down pass folds the smallest room into its longest-shared-edge
 * neighbor until the count fits. Callers with a building type should pass
 * `roomCapFor(type)`.
 */
export declare function partition(path: SeedPath, fp: Footprint, opts: {
    keepMainWhole: boolean;
    maxRooms?: number;
}): number[][];
