import type { ForestKind } from './forestClusters';
/** The slice of a `PackForest` this module reads (structural — the full
 * `forestsPass.ts` PackForest fits). */
interface ForestSlice {
    /** 1-based forest id (0 reserved for "no forest"); breaks size ties. */
    i: number;
    cells: number[];
}
/** A pack that may carry named forests (absent when the forests pass has not
 * run — every lookup then answers null, changing nothing). */
export interface ForestKindPack {
    forests?: Array<ForestSlice & {
        kind: ForestKind;
    }>;
}
/**
 * Pure core: cell → the kind of the named forest it belongs to, or null for
 * cells in no named forest (open land, sea, anonymous copses). Every pack cell
 * is in at most one forest (flood-fill partition), so a plain Map suffices.
 */
export declare function buildForestKindLookup(pack: ForestKindPack): (cell: number) => ForestKind | null;
/**
 * The memoized kind lookup for an atlas. Both per-seed entry points below and
 * `atlasTravelGraph.buildNavInfoFn` (which already holds an atlas and must not
 * touch the bridge) share this cache, so the Map is built once per atlas.
 */
export declare function lookupForAtlas(atlas: {
    pack: ForestKindPack;
}): (cell: number) => ForestKind | null;
/**
 * Seed-keyed convenience: the forest kind of `cellId` in the bridge-cached
 * world, or null when the cell is in no named forest. Same WeakMap cache as
 * `lookupForAtlas` — `getBridgeAtlas` returns one atlas object per seed.
 */
export declare function forestKindForCell(worldSeed: number, cellId: number): ForestKind | null;
/**
 * The name of the LARGEST named forest (most cells; ties to the lowest `i`)
 * that shares at least one cell with the route, or null when the route
 * crosses no named forest. Feeds the travel readout ("through the Angshire
 * Wraithwood") — built here so the module owns all pack.forests reads.
 */
export declare function namedForestOnRoute(pack: {
    forests?: Array<ForestSlice & {
        name: string;
    }>;
}, routeCells: number[]): string | null;
export {};
