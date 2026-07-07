/**
 * @file dungeonStates.ts — Pillar 2, Task 8 (living ecology): assemble the
 * per-site cleared/uncleared state the danger field and raid-pressure signal
 * consume, from (a) the world's enumerated sites and (b) the party's cleared set.
 *
 * A dungeon site starts UNCLEARED. Clearing it appends its frozen `sitePath` to
 * `state.clearedDungeons` (the DUNGEON_CLEARED reducer action). This selector
 * joins the two: `enumerateDungeonSites(worldSeed)` supplies the full site list
 * and their cell ids; the cleared set flips each site's `cleared` flag.
 *
 * The output shape is exactly `computeDangerField`'s `opts.dungeonSites` input,
 * so the map danger overlay can hand it straight through.
 *
 * Pure + deterministic: no draws, no Math.random. Sites come in enumeration
 * order (already sorted). Zero THREE imports.
 */
import { enumerateDungeonSites } from './dungeonSites';
import type { DungeonDangerSite } from '../../overlays/dangerField';

/**
 * The cleared/uncleared state of every dungeon site in a world, keyed by cell
 * for the danger field. `clearedPaths` is the party's set of cleared site paths
 * (from `state.clearedDungeons`); any site whose `sitePath` is in it reads
 * `cleared: true`.
 *
 * @param worldSeed    World seed (drives site enumeration).
 * @param clearedPaths Frozen site paths the party has cleared (order-free).
 * @returns One entry per site, in enumeration order.
 */
export function dungeonStatesForWorld(
  worldSeed: number,
  clearedPaths?: Iterable<string>,
): DungeonDangerSite[] {
  const cleared = clearedPaths instanceof Set ? clearedPaths : new Set(clearedPaths ?? []);
  return enumerateDungeonSites(worldSeed).map((site) => ({
    cellId: site.cellId,
    cleared: cleared.has(site.sitePath),
  }));
}
