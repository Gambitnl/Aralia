/**
 * @file legacySubmapBridge.ts â€” the seam between the LEGACY game world and
 * the Worldforge world (Remy's 2026-06-11 focus, slice 2: Azgaar â†’ submap).
 *
 * The legacy game (world map tiles, Location records, biomeIds) and the
 * Worldforge world (FMG atlas cells) are different worlds with no shared
 * coordinates. This bridge DEFINES the mapping so legacy surfaces can start
 * consuming Worldforge terrain before the legacy world generator is retired
 * (decision: replace aggressively â€” the Azgaar world is becoming THE world):
 *
 *   legacy world-map tile (x, y) on a WÃ—H map
 *     â†’ proportional FMG map position (x/WÂ·960, y/HÂ·540 px)
 *     â†’ nearest LAND atlas cell (water landings walk to the closest land)
 *     â†’ L1 region around that cell â†’ L2 local at the cell center.
 *
 * KNOWN INTERIM MISMATCH (documented, accepted): the legacy location's
 * biomeId does NOT constrain the FMG cell's biome â€” a legacy "forest" can
 * land on Azgaar desert until the world map itself is the atlas. Terrain is
 * deterministic per (worldSeed, location coords) either way.
 *
 * Caching: atlas generation costs ~0.5-1.5 s â€” cached per seed string at
 * module level (one world per session in practice). Regions and locals are
 * cached per anchor/center so re-entering a location is instant.
 */
import { type FmgAtlasResult } from "../fmg/generateAtlas";
import { generateFmgWorld, type FmgWorldResult } from "../fmg/generateWorld";
import { generateRegion } from "../region/generateRegion";
import { generateLocal } from "../local/generateLocal";
import { rootSeedPath } from "../seedPath";
import { FEET_PER_FMG_PIXEL } from "../adapter/atlasArtifact";
import type { LocalArtifact, RegionArtifact } from "../artifacts";

/** FMG canvas the bridge generates against (the demo's standard frame). */
const FMG_WIDTH = 960;
const FMG_HEIGHT = 540;
const FMG_CELLS_DESIRED = 10000;
const FMG_TEMPLATE = "continents";

// â”€â”€ Module caches (one game world per session; keyed defensively anyway) â”€â”€
const atlasCache = new Map<string, FmgWorldResult>();
const regionCache = new Map<string, RegionArtifact>();
const localCache = new Map<string, LocalArtifact>();

/** Deterministic seed string for the FMG world from the game's worldSeed. */
export function worldforgeSeedString(worldSeed: number): string {
  return `aralia-${worldSeed}`;
}

export function getBridgeAtlas(worldSeed: number): FmgWorldResult {
  const seedStr = worldforgeSeedString(worldSeed);
  let atlas = atlasCache.get(seedStr);
  if (!atlas) {
    // FULL world (2026-06-11 ribbons): atlas-only starved bridge regions of
    // burgs/routes — towns and road ribbons were empty by construction.
    atlas = generateFmgWorld(seedStr, {
      width: FMG_WIDTH,
      height: FMG_HEIGHT,
      cellsDesired: FMG_CELLS_DESIRED,
      template: FMG_TEMPLATE,
    });
    atlasCache.set(seedStr, atlas);
  }
  return atlas;
}

/**
 * Map a legacy world-map tile to its anchoring atlas LAND cell.
 * Proportional projection, then nearest land cell by center distance
 * (linear scan â€” 10k cells, sub-millisecond, no index needed).
 */
export function legacyTileToAtlasCell(
  atlas: FmgAtlasResult,
  worldMapX: number,
  worldMapY: number,
  worldMapWidth: number,
  worldMapHeight: number,
): number {
  const px = ((worldMapX + 0.5) / Math.max(1, worldMapWidth)) * FMG_WIDTH;
  const py = ((worldMapY + 0.5) / Math.max(1, worldMapHeight)) * FMG_HEIGHT;

  const { cells } = atlas.pack;
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < cells.h.length; i++) {
    if (cells.h[i] < 20) continue; // land only â€” the submap is walkable ground
    const p = cells.p[i];
    if (!p) continue;
    const dx = p[0] - px;
    const dy = p[1] - py;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  if (best < 0) throw new Error("Bridge: atlas has no land cells");
  return best;
}

export interface BridgeLocalResult {
  local: LocalArtifact;
  region: RegionArtifact;
  /** The atlas cell the location resolved to (diagnostics / future wiring). */
  anchorCellId: number;
  /** FMG biome id used for the local profile. */
  biomeId: number;
}

/**
 * The bridge entry point: deterministic L2 LocalArtifact for a legacy
 * location. Same inputs â†’ byte-identical terrain, every call, every session.
 */
export function getWorldforgeLocalForLocation(
  worldSeed: number,
  worldMapX: number,
  worldMapY: number,
  worldMapWidth: number,
  worldMapHeight: number,
): BridgeLocalResult {
  const atlas = getBridgeAtlas(worldSeed);
  const anchorCellId = legacyTileToAtlasCell(
    atlas, worldMapX, worldMapY, worldMapWidth, worldMapHeight,
  );

  const regionKey = `${worldforgeSeedString(worldSeed)}/cell:${anchorCellId}`;
  let region = regionCache.get(regionKey);
  if (!region) {
    region = generateRegion(atlas, anchorCellId, rootSeedPath(worldSeed), {
      feetPerPixel: FEET_PER_FMG_PIXEL,
      resolutionFt: 100,
      world: atlas,
    });
    regionCache.set(regionKey, region);
  }

  const biomeId = Number(
    (atlas.pack.cells as unknown as { biome?: ArrayLike<number> }).biome?.[anchorCellId] ?? 6,
  );

  const center = {
    x: region.bounds.x + region.bounds.width / 2,
    y: region.bounds.y + region.bounds.height / 2,
  };
  const localKey = `${regionKey}/local:${Math.round(center.x)}-${Math.round(center.y)}`;
  let local = localCache.get(localKey);
  if (!local) {
    local = generateLocal(region, center, region.seedPath, { biomeId });
    localCache.set(localKey, local);
  }

  return { local, region, anchorCellId, biomeId };
}

/** Test/dev hook: drop all cached worlds (e.g. between seeds in a session). */
export function clearBridgeCaches(): void {
  atlasCache.clear();
  regionCache.clear();
  localCache.clear();
}

