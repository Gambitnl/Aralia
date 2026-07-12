/**
 * @file forestKindForCell.ts — which named forest KIND a pack cell sits in.
 *
 * Forests campaign Task 3 (spec 2026-07-11-forests-design): the read side of
 * `pack.forests`. Gameplay asks one question per cell — "what kind of wood is
 * this?" — to escalate biomes (haunted/fey), bump getting-lost DCs, and name
 * the forest a route crosses.
 *
 * Shape: `buildForestKindLookup` is the pure core (pack in, Map-backed lookup
 * out). `lookupForAtlas` memoizes that lookup per atlas OBJECT in a WeakMap so
 * every consumer holding the same bridge-cached atlas (biomeForCell's override,
 * atlasTravelGraph's nav bump) shares one build. `forestKindForCell` is the
 * seed-keyed convenience on top of `getBridgeAtlas` — the only bridge-dependent
 * function here, and that import already lives in biomeForCell's module graph,
 * so nothing new enters any consumer's graph. No import cycle: the bridge
 * never imports travel/ or forests/ read-side modules.
 */
import { getBridgeAtlas } from '../bridge/legacySubmapBridge';
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
  forests?: Array<ForestSlice & { kind: ForestKind }>;
}

/**
 * Pure core: cell → the kind of the named forest it belongs to, or null for
 * cells in no named forest (open land, sea, anonymous copses). Every pack cell
 * is in at most one forest (flood-fill partition), so a plain Map suffices.
 */
export function buildForestKindLookup(
  pack: ForestKindPack,
): (cell: number) => ForestKind | null {
  const kinds = new Map<number, ForestKind>();
  for (const forest of pack.forests ?? []) {
    for (const cell of forest.cells) kinds.set(cell, forest.kind);
  }
  return (cell) => kinds.get(cell) ?? null;
}

/** One lookup per atlas object — keyed on the atlas itself (not the seed) so
 * synthetic test atlases and multiple live worlds each get their own. */
const lookupCache = new WeakMap<object, (cell: number) => ForestKind | null>();

/**
 * The memoized kind lookup for an atlas. Both per-seed entry points below and
 * `atlasTravelGraph.buildNavInfoFn` (which already holds an atlas and must not
 * touch the bridge) share this cache, so the Map is built once per atlas.
 */
export function lookupForAtlas(
  atlas: { pack: ForestKindPack },
): (cell: number) => ForestKind | null {
  let lookup = lookupCache.get(atlas);
  if (!lookup) {
    lookup = buildForestKindLookup(atlas.pack);
    lookupCache.set(atlas, lookup);
  }
  return lookup;
}

/**
 * Seed-keyed convenience: the forest kind of `cellId` in the bridge-cached
 * world, or null when the cell is in no named forest. Same WeakMap cache as
 * `lookupForAtlas` — `getBridgeAtlas` returns one atlas object per seed.
 */
export function forestKindForCell(worldSeed: number, cellId: number): ForestKind | null {
  return lookupForAtlas(getBridgeAtlas(worldSeed))(cellId);
}

/**
 * The name of the LARGEST named forest (most cells; ties to the lowest `i`)
 * that shares at least one cell with the route, or null when the route
 * crosses no named forest. Feeds the travel readout ("through the Angshire
 * Wraithwood") — built here so the module owns all pack.forests reads.
 */
export function namedForestOnRoute(
  pack: { forests?: Array<ForestSlice & { name: string }> },
  routeCells: number[],
): string | null {
  const onRoute = new Set(routeCells);
  let best: (ForestSlice & { name: string }) | null = null;
  for (const forest of pack.forests ?? []) {
    if (!forest.cells.some((cell) => onRoute.has(cell))) continue;
    if (
      !best
      || forest.cells.length > best.cells.length
      || (forest.cells.length === best.cells.length && forest.i < best.i)
    ) {
      best = forest;
    }
  }
  return best ? best.name : null;
}
