/**
 * @file Golden drill-path fixture: deterministically drills one settlement cell
 * World -> Region -> Local -> Ground for the cell-provenance-audit tests.
 */
import {
  getBridgeAtlas,
  getTownTilesForGrid,
  getWorldforgeLocalForLocation,
} from '../../../bridge/legacySubmapBridge';
import { makeGroundWorld } from '../../../bridge/groundChunkLoader';
import type { GroundWorld } from '../../../bridge/groundChunkLoader';
import type { LocalArtifact, RegionArtifact } from '../../../artifacts';
import type { Pack } from '../../../fmg/features';

export const GOLDEN_WORLD_SEED = 12345;
export const GRID_COLS = 64;
export const GRID_ROWS = 64;

export interface GoldenDrillPath {
  pack: Pack;
  cellId: number;
  burgId: number;
  /** FMG biome id the submap pipeline actually used for the local */
  biomeIdUsed: number;
  region: RegionArtifact;
  local: LocalArtifact;
  ground: GroundWorld;
}

/**
 * Deterministically drills one settlement cell World -> Region -> Local -> Ground.
 * Picks the first burg-bearing tile on a 64x64 grid for the golden seed.
 */
export function buildGoldenDrillPath(): GoldenDrillPath {
  const atlas = getBridgeAtlas(GOLDEN_WORLD_SEED);
  const pack = atlas.pack;

  const townTiles = getTownTilesForGrid(GOLDEN_WORLD_SEED, GRID_COLS, GRID_ROWS);
  if (townTiles.length === 0) {
    throw new Error('drillPath fixture: golden seed produced no town tiles');
  }
  const tile = townTiles[0];
  const burgId = tile.burgId;
  if (!pack.burgs) {
    throw new Error('drillPath fixture: atlas pack has no burgs (slice-3 not generated)');
  }
  const burg = pack.burgs[burgId];
  if (!burg) {
    throw new Error(`drillPath fixture: burg ${burgId} not found on pack`);
  }
  const cellId = burg.cell;

  const bridged = getWorldforgeLocalForLocation(
    GOLDEN_WORLD_SEED,
    tile.x,
    tile.y,
    GRID_COLS,
    GRID_ROWS,
  );
  const ground = makeGroundWorld(bridged.local, GOLDEN_WORLD_SEED, bridged.region);

  return {
    pack,
    cellId,
    burgId,
    biomeIdUsed: bridged.biomeId,
    region: bridged.region,
    local: bridged.local,
    ground,
  };
}
