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
export declare function dungeonStatesForWorld(worldSeed: number, clearedPaths?: Iterable<string>): DungeonDangerSite[];
