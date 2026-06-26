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
import { generateFmgWorld, type FmgWorldResult } from '../fmg/generateWorld';
import type { MapData } from '../../../types';
import { atlasCellToLegacyGrid, legacyGridToAtlasCell, type GridCoord, type GridSize } from './gridAtlasBridge';
import { unifyMapBiomesWithWorld } from './unifyMapBiomes';

const LAND_THRESHOLD = 20;

/** True when a grid cell's CENTER maps to a WF land cell (so the marker + the
 *  unified biome there are land, not sea — the grid is coarse, so a coastal
 *  burg's cell can otherwise center over water). */
function gridCellIsLand(world: FmgWorldResult, cell: GridCoord, gridSize: GridSize): boolean {
  const c = legacyGridToAtlasCell(world, cell, gridSize);
  return c >= 0 && world.pack.cells.h[c] >= LAND_THRESHOLD;
}

/** Nearest grid cell (ring-by-ring from `origin`) whose center maps to WF land. */
function nearestLandGridCell(world: FmgWorldResult, origin: GridCoord, gridSize: GridSize): GridCoord | null {
  const cols = gridSize.cols || 1;
  const rows = gridSize.rows || 1;
  const maxR = Math.max(cols, rows);
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // ring perimeter only
        const x = origin.x + dx;
        const y = origin.y + dy;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        if (gridCellIsLand(world, { x, y }, gridSize)) return { x, y };
      }
    }
  }
  return null;
}

export interface WorldSpawn {
  /** Resolved WF atlas cell id. */
  atlasCellId: number;
  /** The legacy grid cell the spawn maps onto (for `mapData`/`isPlayerCurrent`). */
  gridCell: GridCoord;
  /** Biome index of the spawn cell (from `pack.cells.biome`), if available. */
  biomeIndex?: number;
  /** Name of the burg the spawn is anchored to, if any. */
  burgName?: string;
}

interface BurgLike { i?: number; cell?: number; capital?: number; removed?: boolean; name?: string }

/**
 * Resolve a deterministic WF spawn: the capital burg, else the first real burg,
 * else the first habitable land cell. Maps to the legacy grid via the bridge.
 */
export function resolveWorldSpawn(world: FmgWorldResult, gridSize: GridSize): WorldSpawn {
  const burgs = (world.pack.burgs ?? []) as BurgLike[];
  const isReal = (b: BurgLike): boolean => !!b && b.i !== 0 && !b.removed && typeof b.cell === 'number';
  const chosen = burgs.find((b) => isReal(b) && !!b.capital) ?? burgs.find(isReal);

  let atlasCellId: number;
  let burgName: string | undefined;
  if (chosen && typeof chosen.cell === 'number') {
    atlasCellId = chosen.cell;
    burgName = chosen.name;
  } else {
    // Fallback: the first land cell (h >= land threshold), else cell 0.
    const h = world.pack.cells.h;
    let land = -1;
    for (let i = 0; i < h.length; i++) { if (h[i] >= LAND_THRESHOLD) { land = i; break; } }
    atlasCellId = land >= 0 ? land : 0;
  }

  return spawnFromAtlasCell(world, gridSize, atlasCellId, burgName);
}

/**
 * Map a chosen WF atlas land cell onto a non-ocean legacy grid spawn. Shared by
 * the auto resolver and explicit town selection: the grid is coarse (e.g. 30×20),
 * so a coastal cell's grid cell can center over water — which would put the spawn
 * marker (grid-cell center) in the sea. Nudge to the nearest land grid cell.
 */
export function spawnFromAtlasCell(
  world: FmgWorldResult,
  gridSize: GridSize,
  atlasCellId: number,
  burgName?: string,
): WorldSpawn {
  let gridCell = atlasCellToLegacyGrid(world, atlasCellId, gridSize)
    ?? { x: Math.floor((gridSize.cols || 1) / 2), y: Math.floor((gridSize.rows || 1) / 2) };

  if (!gridCellIsLand(world, gridCell, gridSize)) {
    gridCell = nearestLandGridCell(world, gridCell, gridSize) ?? gridCell;
  }

  const biomeIndex = world.pack.cells.biome?.[atlasCellId];
  return { atlasCellId, gridCell, biomeIndex, burgName };
}

export interface RelocateStartOptions {
  /** Desired start-tile biome (e.g. the WF-derived biome). Applied if walkable. */
  biomeId?: string;
  /** Walkable biome to fall back to when the desired/tile biome isn't walkable. */
  fallbackBiomeId?: string;
  /** Predicate; a biome that returns false is replaced by the fallback. */
  isWalkable?: (biomeId: string) => boolean;
}

/**
 * Move the player's start tile (`isPlayerCurrent`) to `cell`. Sets the tile's
 * biome to the desired WF-derived `biomeId` (so the map + opening reflect the
 * generated world) when it's walkable, otherwise the `fallbackBiomeId`; with no
 * `biomeId` it keeps the tile's own biome under the same walkability guard.
 * Mutates the passed mapData tiles; `cell` is clamped to the grid.
 */
export function relocateStartTile(mapData: MapData, cell: GridCoord, opts: RelocateStartOptions = {}): void {
  const { rows, cols } = mapData.gridSize;
  const x = Math.min(cols - 1, Math.max(0, cell.x));
  const y = Math.min(rows - 1, Math.max(0, cell.y));
  const target = mapData.tiles[y]?.[x];
  if (!target) return;
  for (const row of mapData.tiles) {
    for (const t of row) if (t.isPlayerCurrent) t.isPlayerCurrent = false;
  }
  target.isPlayerCurrent = true;
  target.discovered = true;
  const desired = opts.biomeId ?? target.biomeId;
  const walkable = opts.isWalkable ? opts.isWalkable(desired) : true;
  target.biomeId = walkable ? desired : (opts.fallbackBiomeId ?? target.biomeId);
}

export interface ApplyWfSpawnOptions {
  /** Map the spawn cell's WF biome index to a legacy biome id for the start tile. */
  biomeIndexToLegacyId?: (biomeIndex: number | undefined) => string | undefined;
  /** Walkable biome to fall back to when the WF biome isn't walkable. */
  fallbackBiomeId?: string;
  /** Predicate; a biome that returns false is replaced by the fallback. */
  isWalkable?: (biomeId: string) => boolean;
  /**
   * Spawn at THIS WF atlas cell (a player-chosen town's `burg.cell`) instead of
   * the auto capital/burg pick. Set by the Start Point Selection step.
   */
  spawnAtlasCellId?: number;
  /** Name recorded for a chosen-cell spawn (the town's name). */
  spawnBurgName?: string;
}

/**
 * Re-place the player on a WF-derived LAND spawn for a freshly (re)generated map:
 * unify the grid's biomes to the WF world, resolve a land/burg spawn cell, and
 * move the start tile there (kept walkable via the biome guard). Call this at
 * new-game start AND on every world reroll so the player is never stranded on an
 * ocean tile. Mutates `mapData`; returns the resolved spawn.
 */
export function applyWfSpawnToMap(
  mapData: MapData,
  worldSeed: number,
  gridSize: GridSize,
  opts: ApplyWfSpawnOptions = {},
): WorldSpawn {
  const world = generateFmgWorld(String(worldSeed));
  unifyMapBiomesWithWorld(mapData, world, gridSize);
  const spawn = opts.spawnAtlasCellId != null
    ? spawnFromAtlasCell(world, gridSize, opts.spawnAtlasCellId, opts.spawnBurgName)
    : resolveWorldSpawn(world, gridSize);
  relocateStartTile(mapData, spawn.gridCell, {
    biomeId: opts.biomeIndexToLegacyId?.(spawn.biomeIndex),
    fallbackBiomeId: opts.fallbackBiomeId,
    isWalkable: opts.isWalkable,
  });
  return spawn;
}
