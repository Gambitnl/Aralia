/**
 * @file unifyMapBiomes.ts — make the legacy `mapData` grid the WF world.
 *
 * The 20×30 `mapData` grid historically took biomes from `runWorldSim` (a
 * separate world from the WF/FMG atlas). This rewrites each tile's biome from
 * the WF world instead: a grid cell maps to its WF atlas cell (via the
 * grid↔atlas bridge); land cells take that cell's WF biome (translated to a
 * legacy id), water cells become impassable ocean. Location-anchored tiles are
 * preserved walkable so the static location graph can't be stranded.
 *
 * Pure-ish: mutates `mapData.tiles`. The keystone of the map↔WF unification.
 */
import type { FmgWorldResult } from '../fmg/generateWorld';
import type { MapData } from '../../../types';
import { legacyGridToAtlasCell, type GridSize } from './gridAtlasBridge';
import { wfBiomeIndexToLegacyId } from './wfBiomeToLegacy';

const LAND_THRESHOLD = 20;

export interface UnifyMapBiomesOptions {
  /** Biome id for WF water cells (impassable). Default 'ocean'. */
  waterBiomeId?: string;
  /** Skip tiles carrying a locationId (preserve location anchors). Default true. */
  preserveLocations?: boolean;
}

/**
 * Rewrite each `mapData` tile's biome from the WF world. Land cells → the WF
 * biome (legacy id); water cells → `waterBiomeId`. Location-anchored tiles are
 * left untouched. Returns the number of tiles rewritten.
 */
export function unifyMapBiomesWithWorld(
  mapData: MapData,
  world: FmgWorldResult,
  gridSize: GridSize,
  opts: UnifyMapBiomesOptions = {},
): number {
  const waterBiomeId = opts.waterBiomeId ?? 'ocean';
  const preserve = opts.preserveLocations !== false;
  const h = world.pack.cells.h;
  const biome = world.pack.cells.biome;
  let rewritten = 0;
  for (let y = 0; y < mapData.tiles.length; y++) {
    const row = mapData.tiles[y];
    for (let x = 0; x < row.length; x++) {
      const tile = row[x];
      if (preserve && tile.locationId) continue; // keep location anchors walkable
      const cell = legacyGridToAtlasCell(world, { x, y }, gridSize);
      if (cell < 0) continue;
      tile.biomeId = h[cell] >= LAND_THRESHOLD ? wfBiomeIndexToLegacyId(biome?.[cell]) : waterBiomeId;
      rewritten++;
    }
  }
  return rewritten;
}
