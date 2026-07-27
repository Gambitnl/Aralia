/** The slice of a `PackRange` this module reads (structural — the full
 * `mountainsPass.ts` PackRange fits). */
interface RangeSlice {
    /** 1-based range id (0 reserved for "no range"). */
    i: number;
    /** Member pack-cell ids. Every range cell is in exactly one range. */
    cells: number[];
}
/** The slice of a `PackPeak` this module reads. */
interface PeakSlice {
    cellId: number;
}
/** A pack that may carry named ranges/peaks (absent when the mountains pass
 * has not run — rangeIdOf then answers null and isPeakCell false, so only the
 * raw-height alpine rule can still fire). */
export interface RangeLookupPack {
    ranges?: RangeSlice[];
    peaks?: PeakSlice[];
}
/** The cell fields the elevation-class rules consult (structural — the full
 * FMG `Pack['cells']` fits; crafted test packs may omit any of them). */
interface ElevationCells {
    /** FMG biome index per cell (11 = Glacier, the never-escalated index). */
    biome?: ArrayLike<number>;
    /** Encoded pack height (0–100 scale). */
    h?: ArrayLike<number>;
    /** Adjacency: `c[cell]` lists the neighbouring cell ids. */
    c?: ArrayLike<readonly number[]>;
}
/** The atlas slice both entry points read. */
export interface RangeAtlas {
    pack: RangeLookupPack & {
        cells: ElevationCells;
    };
}
/** What `buildRangeLookup` answers per cell. */
export interface RangeLookup {
    /** The 1-based id of the named range the cell belongs to, or null outside
     * every named range (open land, sea, anonymous hills). */
    rangeIdOf: (cell: number) => number | null;
    /** Whether the cell is a named peak (a strict local maximum, h >= 70). */
    isPeakCell: (cell: number) => boolean;
}
/**
 * Pure core: Map/Set-backed range + peak membership. Every range cell is in
 * exactly one range (flood-fill partition) and every peak has one cell, so a
 * plain Map and Set suffice.
 */
export declare function buildRangeLookup(pack: RangeLookupPack): RangeLookup;
/** How high a cell plays, for the biome escalation: crag (peaks), alpine
 * (high country), plateau (named-range shoulders), vale (enclosed pockets). */
export type ElevationClass = 'crag' | 'alpine' | 'plateau' | 'vale';
/**
 * The memoized range lookup for an atlas. `biomeForCell`'s escalation and the
 * later travel consumers (nav bump, climb cost, pass detection) all hold the
 * same bridge-cached atlas, so the Map/Set is built once per atlas.
 */
export declare function lookupRangesForAtlas(atlas: RangeAtlas): ReturnType<typeof buildRangeLookup>;
/**
 * The elevation class of `cellId` in this atlas, or null when no escalation
 * rule fires (the caller then keeps today's mapping byte-identically). Cached
 * per (atlas, cell) alongside the range lookup — one WeakMap entry holds both.
 */
export declare function elevationClassForCell(atlas: RangeAtlas, cellId: number): ElevationClass | null;
/** The slice of a `PackPass` this module reads (structural — the full
 * `mountainsPass.ts` PackPass fits). */
interface PassSlice {
    /** The crest cell the pass sits on. */
    cellId: number;
    name: string;
}
/**
 * The name of the FIRST named pass the route crosses, in ROUTE order, or
 * null when it crests none. Feeds the travel readout ("via Ironteeth Pass")
 * — route order, not pass id, because the trip announces the pass it reaches
 * first. Pure and cache-free: a route is a handful of cells and passes are
 * few, so a per-call Map costs nothing worth memoizing (mountains Task 4).
 */
export declare function passNameOnRoute(pack: {
    passes?: PassSlice[];
}, routeCells: number[]): string | null;
export {};
