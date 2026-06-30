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
import { getBridgeAtlas } from '../bridge/legacySubmapBridge';
import type { MapData } from '../../../types';
import { atlasCellToLegacyGrid, legacyGridToAtlasCell, type GridCoord, type GridSize } from './gridAtlasBridge';

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

// Grid retirement (2026-06-30): `relocateStartTile` (+ RelocateStartOptions) is
// removed — it mutated the 30x20 grid's `isPlayerCurrent`/biome tiles, which
// nothing in the live game reads now (position + biome are cell-native).

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
 * Resolve a WF-derived LAND spawn for a new game / world reroll: pick the
 * capital/burg/land cell (optionally a player-chosen town) and return it.
 *
 * Grid retirement (2026-06-30): this NO LONGER mutates `mapData` — the legacy
 * biome-unification and `isPlayerCurrent` start-tile placement wrote into the
 * 30x20 grid, which nothing in the live game reads anymore (biome + position are
 * cell-native: `playerCell.cellId` + `biomeIdForCell`). The caller derives the
 * player's location/cell from `spawn.atlasCellId` (and the legacy `gridCell`
 * bookkeeping). `mapData`/`opts` biome args are retained on the signature for the
 * callers until the coord_X_Y/save cut lands; they are intentionally unused here.
 */
export function applyWfSpawnToMap(
  worldSeed: number,
  gridSize: GridSize,
  opts: ApplyWfSpawnOptions = {},
): WorldSpawn {
  // WM1: spawn into the SAME canonical world the player sees in-game
  // (`getBridgeAtlas(seed)`), so a chosen town's `spawnAtlasCellId` refers to a
  // burg that exists in the rendered world.
  const world = getBridgeAtlas(worldSeed);
  return opts.spawnAtlasCellId != null
    ? spawnFromAtlasCell(world, gridSize, opts.spawnAtlasCellId, opts.spawnBurgName)
    : resolveWorldSpawn(world, gridSize);
}
