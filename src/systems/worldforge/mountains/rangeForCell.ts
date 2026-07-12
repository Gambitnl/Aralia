/**
 * @file rangeForCell.ts — which named RANGE a pack cell sits in, and the
 * cell's elevation class.
 *
 * Mountains campaign Task 5 (spec 2026-07-11-mountains-design §3): the read
 * side of `pack.ranges` + `pack.peaks` (+ `pack.passes` via passNameOnRoute,
 * Task 4). Gameplay asks two questions per cell — "which range is this?"
 * (nav bumps, climb costs, pass detection share it) and "how high does it
 * play?" — the elevation class that revives the four dead mountain biomes in
 * `biomeForCell`.
 *
 * Shape (forestKindForCell is the template): `buildRangeLookup` is the pure
 * core (pack in, Map/Set-backed lookup out). `lookupRangesForAtlas` memoizes
 * per atlas OBJECT in a WeakMap; the same entry also carries the lazily
 * filled per-cell elevation-class map, so `elevationClassForCell` and every
 * range consumer holding the same bridge-cached atlas share ONE build. No
 * bridge import — both entry points take the atlas the caller already holds,
 * so nothing new enters any consumer's module graph and no import cycle can
 * form (`mountainTunables` pulls only type-only imports).
 *
 * Elevation-class rules, in order (escalate-only; §3 first bullet):
 *   1. biome index 11 (Glacier) → null — the plain mapping already answers
 *      `mountain_glacier`, byte-identically, and escalation never touches it;
 *   2. peak cell → 'crag';
 *   3. h < 20 (water) → null — water never escalates, so a mountain TARN
 *      ringed by range cells keeps its marine mapping instead of reading as
 *      a vale (controller ruling on the reviewer's tarn finding);
 *   4. h >= PEAK_MIN_H (70), non-peak → 'alpine' (raw height — no range
 *      membership required);
 *   5. RANGE_MIN_H (50) <= h < 70 inside a named range → 'plateau'
 *      (anonymous hills stay null);
 *   6. h < 50 with EVERY neighbour a range cell → 'vale' (an enclosed pocket;
 *      a cell with no neighbour data is never vacuously enclosed);
 *   7. else null — the caller keeps today's mapping byte-identically.
 */
import { PEAK_MIN_H, RANGE_MIN_H } from './mountainTunables';

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
  pack: RangeLookupPack & { cells: ElevationCells };
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
export function buildRangeLookup(pack: RangeLookupPack): RangeLookup {
  const rangeIds = new Map<number, number>();
  for (const range of pack.ranges ?? []) {
    for (const cell of range.cells) rangeIds.set(cell, range.i);
  }
  const peakCells = new Set<number>();
  for (const peak of pack.peaks ?? []) peakCells.add(peak.cellId);
  return {
    rangeIdOf: (cell) => rangeIds.get(cell) ?? null,
    isPeakCell: (cell) => peakCells.has(cell),
  };
}

/** How high a cell plays, for the biome escalation: crag (peaks), alpine
 * (high country), plateau (named-range shoulders), vale (enclosed pockets). */
export type ElevationClass = 'crag' | 'alpine' | 'plateau' | 'vale';

/** The FMG biome index the escalation must never touch (file header rule 1). */
const GLACIER_BIOME_INDEX = 11;

/** One cached entry per atlas object: the range lookup AND the lazily filled
 * per-cell class map ride together, so every consumer shares one build. */
interface RangeEntry {
  lookup: RangeLookup;
  classOf: (cellId: number) => ElevationClass | null;
}

/** Keyed on the atlas OBJECT (not the seed) so synthetic test atlases and
 * multiple live worlds each get their own entry. */
const entryCache = new WeakMap<object, RangeEntry>();

/** The elevation-class rules (file header) against one atlas's pack. */
function classify(
  cells: ElevationCells,
  lookup: RangeLookup,
  cellId: number,
): ElevationClass | null {
  if (cells.biome?.[cellId] === GLACIER_BIOME_INDEX) return null;
  if (lookup.isPeakCell(cellId)) return 'crag';
  const h = cells.h?.[cellId];
  if (h == null) return null;
  // Water guard (file header rule 3): FMG encodes land as h >= 20 — a tarn
  // must keep its marine mapping, never read as a vale.
  if ((h ?? 0) < 20) return null;
  if (h >= PEAK_MIN_H) return 'alpine';
  if (h >= RANGE_MIN_H) return lookup.rangeIdOf(cellId) != null ? 'plateau' : null;
  const neighbours = cells.c?.[cellId];
  if (!neighbours || neighbours.length === 0) return null; // never vacuously enclosed
  for (const neighbour of neighbours) {
    if (lookup.rangeIdOf(neighbour) == null) return null;
  }
  return 'vale';
}

/** The one cached entry for an atlas — built on first touch by EITHER entry
 * point below. */
function entryForAtlas(atlas: RangeAtlas): RangeEntry {
  let entry = entryCache.get(atlas);
  if (!entry) {
    const lookup = buildRangeLookup(atlas.pack);
    const classes = new Map<number, ElevationClass | null>();
    const classOf = (cellId: number): ElevationClass | null => {
      let elevationClass = classes.get(cellId);
      if (elevationClass === undefined) {
        elevationClass = classify(atlas.pack.cells, lookup, cellId);
        classes.set(cellId, elevationClass);
      }
      return elevationClass;
    };
    entry = { lookup, classOf };
    entryCache.set(atlas, entry);
  }
  return entry;
}

/**
 * The memoized range lookup for an atlas. `biomeForCell`'s escalation and the
 * later travel consumers (nav bump, climb cost, pass detection) all hold the
 * same bridge-cached atlas, so the Map/Set is built once per atlas.
 */
export function lookupRangesForAtlas(atlas: RangeAtlas): ReturnType<typeof buildRangeLookup> {
  return entryForAtlas(atlas).lookup;
}

/**
 * The elevation class of `cellId` in this atlas, or null when no escalation
 * rule fires (the caller then keeps today's mapping byte-identically). Cached
 * per (atlas, cell) alongside the range lookup — one WeakMap entry holds both.
 */
export function elevationClassForCell(
  atlas: RangeAtlas,
  cellId: number,
): ElevationClass | null {
  return entryForAtlas(atlas).classOf(cellId);
}

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
export function passNameOnRoute(
  pack: { passes?: PassSlice[] },
  routeCells: number[],
): string | null {
  const passes = pack.passes;
  if (!passes || passes.length === 0) return null;
  const nameByCell = new Map<number, string>();
  for (const pass of passes) nameByCell.set(pass.cellId, pass.name);
  for (const cell of routeCells) {
    const name = nameByCell.get(cell);
    if (name != null) return name;
  }
  return null;
}
