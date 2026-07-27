/**
 * @file resolveSpawn.ts — WF-derived player spawn resolver.
 *
 * The legacy spawn is hardcoded (`STARTING_LOCATION_ID = 'clearing'` at a fixed
 * grid coordinate, with the local position set to the center of the now-removed
 * 20×30 submap). This resolves a spawn from the actual WF/FMG world instead:
 * pick a sensible civilization-adjacent cell (the capital burg, else any burg,
 * else a habitable land cell), and map it onto the legacy grid via the
 * grid↔atlas bridge so the player starts where the generated world says they
 * should — one origin shared with the atlas (and, in time, 3D).
 *
 * Pure: no React/DOM. Deterministic from the world.
 */
import { type FmgWorldResult } from '../fmg/generateWorld';
export interface WorldSpawn {
    /** Resolved WF atlas cell id — the player's spawn cell. */
    atlasCellId: number;
    /** Biome index of the spawn cell (from `pack.cells.biome`), if available. */
    biomeIndex?: number;
    /** Name of the burg the spawn is anchored to, if any. */
    burgName?: string;
}
/**
 * Resolve a deterministic WF spawn CELL: the capital burg, else the first real
 * burg, else the first habitable land cell.
 *
 * Grid retirement (2026-07-01): cell-native. The chosen cell is a burg's cell (or
 * a land cell by the h-threshold), so it is land by definition — the old coarse
 * 30×20 grid mapping + the "nudge off a water grid cell" logic are gone.
 */
export declare function resolveWorldSpawn(world: FmgWorldResult): WorldSpawn;
/** Build a WorldSpawn from a chosen atlas land cell (e.g. a burg's own cell). */
export declare function spawnFromAtlasCell(world: FmgWorldResult, atlasCellId: number, burgName?: string): WorldSpawn;
export interface ApplyWfSpawnOptions {
    /**
     * Spawn at THIS WF atlas cell (a player-chosen town's `burg.cell`) instead of
     * the auto capital/burg pick. Set by the Start Point Selection step.
     */
    spawnAtlasCellId?: number;
    /** Name recorded for a chosen-cell spawn (the town's name). */
    spawnBurgName?: string;
}
/**
 * Resolve a WF-derived LAND spawn CELL for a new game / world reroll: the
 * capital/burg/land cell (optionally a player-chosen town).
 *
 * Grid retirement (2026-07-01): fully cell-native — returns just the atlas cell.
 * The caller sets the player's location/cell from `spawn.atlasCellId`. No 30×20
 * grid, no mapData mutation, no gridSize.
 */
export declare function applyWfSpawnToMap(worldSeed: number, opts?: ApplyWfSpawnOptions): WorldSpawn;
