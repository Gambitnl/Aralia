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

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 02/11/2026, 18:02:39
 * Dependents: components/DesignPreview/steps/JudgeLandCompare.tsx, components/DesignPreview/steps/PreviewStartSelect.tsx, components/DesignPreview/steps/PreviewTown3D.tsx, components/DesignPreview/steps/landTerrainJob.ts, components/DesignPreview/steps/landTypeCensus.ts, components/DesignPreview/steps/sidebyside/sideBySideTerrainJob.ts, components/MapPane.tsx, components/World3D/WebGPUProbe.tsx, components/World3D/World3DDemo.tsx, components/World3D/World3DWrapper.tsx, components/World3D/worldGenCore.ts, components/Worldforge/AtlasDemo.tsx, components/Worldforge/SpawnPreview.tsx, components/Worldforge/responsiveAtlasCore.ts, components/Worldforge/responsiveAtlasPreparation.ts, components/Worldforge/useOffThreadBridgeAtlas.ts, hooks/useTownCrierAnnouncements.ts, hooks/useTownSimRegistration.ts, hooks/useVoyageArrival.ts, systems/companions/companionWorldActivitySource.ts, systems/gameplay/lodging.ts, systems/religion/worldforgeTemple.ts, systems/social/npcInstitutionStatements.ts, systems/spells/ai/MaterialTagService.ts, systems/travel/learnedLibraryDestinations.ts, systems/travel/npcLocalDirections.ts, systems/worldforge/bridge/groundChunkLoader.ts, systems/worldforge/bridge/settlementDefense.ts, systems/worldforge/chronicle/worldChronicle.ts, systems/worldforge/dungeon/world/chronicle.ts, systems/worldforge/dungeon/world/deriveIdentity.ts, systems/worldforge/dungeon/world/dungeonSites.ts, systems/worldforge/dungeon/world/raidPressure.ts, systems/worldforge/dungeon/world/rumors.ts, systems/worldforge/forests/forestKindForCell.ts, systems/worldforge/interior/libraryCollection.ts, systems/worldforge/leaf3d/atlasGroundRestore.ts, systems/worldforge/local/biomeForCell.ts, systems/worldforge/local/burgProximity.ts, systems/worldforge/local/resolveSpawn.ts, systems/worldforge/town/prepareHistoricalTownLoad.ts, systems/worldforge/town/townBuildingVisit.ts, systems/worldforge/town/townMapPosition.ts, systems/worldforge/townsim/buildingHistoryCompaction.ts, systems/worldforge/townsim/chronicleForLocation.ts, systems/worldforge/townsim/registerBurgMerchants.ts, systems/worldforge/townsim/townSimRegistration.ts, systems/worldforge/travel/localGroundJourney.ts
 * Imports: 14 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { type FmgAtlasResult } from "../fmg/generateAtlas";
import { generateFmgWorld, type FmgWorldResult } from "../fmg/generateWorld";
import { generateRegionFromSource, type TerrainSourceRevision } from "../region/terrainSource";
import { generateLocal } from "../local/generateLocal";
import { rootSeedPath } from "../seedPath";
import { FEET_PER_FMG_PIXEL } from "../adapter/atlasArtifact";
import { LOCAL_SIZE_FT } from "../units";
import { CURRENT_TOWN_LAYOUT_REVISION, type TownLayoutStates } from "../town/townLayoutRevision";
import { POPULATION_RATE, townEnvelopeHalfFtForPeople } from "../town/townScale";
import type { LocalArtifact, RegionArtifact, RegionTownSite } from "../artifacts";
import type { Burg } from "../fmg/burgs-generator";
import { NamesGenerator } from "../fmg/names-generator";
import Alea from "alea";
import { canonicalArtifactTownForSiteFromAtlas } from "../town/canonicalTown";
import { quadtree } from "../fmg/utils/quadtree";

/** FMG canvas the bridge generates against (the demo's standard frame). */
const FMG_WIDTH = 960;
const FMG_HEIGHT = 540;
const FMG_CELLS_DESIRED = 10000;
const FMG_TEMPLATE = "continents";

// â”€â”€ Module caches (one game world per session; keyed defensively anyway) â”€â”€
// Keep at most MAX_CACHED_WORLD_SEEDS (3) worlds in memory at once (GG-579):
// the active running game world (never dropped while pinned) plus up to 2
// recent preview/regenerated seeds (or 3 recent seeds when no game world is
// pinned). Each full FMG world + SVG model + regions/locals/town tiles/namers
// holds tens of MBs of typed arrays and Voronoi state; 3 worlds cover the live
// game plus A/B preview comparison without unbounded growth when rolling seeds.
export const MAX_CACHED_WORLD_SEEDS = 3;

const atlasCache = new Map<string, FmgWorldResult>();
const regionCache = new Map<string, RegionArtifact>();
const localCache = new Map<string, LocalArtifact>();
const townTileCache = new Map<string, TownTileEntry[]>();
const namerCache = new Map<string, NamesGenerator>();

const recentWorldSeeds: number[] = [];
let activeGameWorldSeed: number | null = null;

export interface WorldSeedCacheListener {
  onEvictSeed(worldSeed: number): void;
  onClearAll(): void;
}

const worldSeedCacheListeners = new Set<WorldSeedCacheListener>();

/**
 * Register a companion per-seed cache (such as responsiveAtlasPreparation's
 * preparedCache) so it drops evicted seeds in lockstep with the bridge caches.
 */
export function registerWorldSeedCacheListener(
  listener: WorldSeedCacheListener,
): () => void {
  worldSeedCacheListeners.add(listener);
  return () => {
    worldSeedCacheListeners.delete(listener);
  };
}

function evictWorldSeedFromAllCaches(worldSeed: number): void {
  const idx = recentWorldSeeds.indexOf(worldSeed);
  if (idx >= 0) {
    recentWorldSeeds.splice(idx, 1);
  }
  const seedStr = worldforgeSeedString(worldSeed);
  atlasCache.delete(seedStr);
  namerCache.delete(seedStr);

  const regionAndLocalPrefix = `${seedStr}/`;
  for (const key of regionCache.keys()) {
    if (key.startsWith(regionAndLocalPrefix)) {
      regionCache.delete(key);
    }
  }
  for (const key of localCache.keys()) {
    if (key.startsWith(regionAndLocalPrefix)) {
      localCache.delete(key);
    }
  }

  const townTilePrefix = `${seedStr}|`;
  for (const key of townTileCache.keys()) {
    if (key.startsWith(townTilePrefix)) {
      townTileCache.delete(key);
    }
  }

  for (const listener of worldSeedCacheListeners) {
    listener.onEvictSeed(worldSeed);
  }
}

function enforceWorldSeedCacheLimit(): void {
  while (recentWorldSeeds.length > MAX_CACHED_WORLD_SEEDS) {
    const victimIdx = recentWorldSeeds.findIndex(
      (seed) => seed !== activeGameWorldSeed,
    );
    if (victimIdx < 0) break;
    evictWorldSeedFromAllCaches(recentWorldSeeds[victimIdx]);
  }
}

/**
 * Record that `worldSeed` was just read or populated in a per-seed cache and
 * evict the oldest non-game world across all per-seed caches if over budget.
 */
export function touchWorldSeedCache(worldSeed: number): void {
  const existingIdx = recentWorldSeeds.indexOf(worldSeed);
  if (existingIdx >= 0) {
    recentWorldSeeds.splice(existingIdx, 1);
  }
  recentWorldSeeds.push(worldSeed);
  enforceWorldSeedCacheLimit();
}

/**
 * Remove a seed from the LRU list if an off-thread preparation failed before
 * installing anything into the bridge caches.
 */
export function releaseUninstalledWorldSeedCache(
  worldSeed: number,
  hasPreparedEntry: boolean,
): void {
  if (hasPreparedEntry) return;
  if (atlasCache.has(worldforgeSeedString(worldSeed))) return;
  const idx = recentWorldSeeds.indexOf(worldSeed);
  if (idx >= 0) {
    recentWorldSeeds.splice(idx, 1);
  }
}

/**
 * Pin the running game's world seed so preview rolls never evict the live game
 * world. Pass `null` when no game world is active.
 */
export function setGameWorldSeed(worldSeed: number | null): void {
  activeGameWorldSeed =
    worldSeed != null && Number.isFinite(worldSeed) ? worldSeed : null;
  if (
    activeGameWorldSeed !== null &&
    recentWorldSeeds.includes(activeGameWorldSeed)
  ) {
    touchWorldSeedCache(activeGameWorldSeed);
  } else {
    enforceWorldSeedCacheLimit();
  }
}

export function getGameWorldSeed(): number | null {
  return activeGameWorldSeed;
}

/**
 * Return the world seeds currently tracked across the unified per-seed caches
 * (oldest to newest).
 */
export function getCachedWorldSeeds(): number[] {
  return [...recentWorldSeeds];
}

export interface TownTileEntry {
  x: number;
  y: number;
  burgId: number;
  name: string;
}

type LiveBurg = Burg & { i: number };

/** Deterministic seed string for the FMG world from the game's worldSeed. */
export function worldforgeSeedString(worldSeed: number): string {
  return `aralia-${worldSeed}`;
}

/**
 * Culture-true person namer for a burg's roster (SPEC: AI/procedural names
 * per culture). FMG's Markov name chains draw from the GLOBAL Math.random
 * (see fmg/utils/probabilityUtils RNG CONTRACT), so each call swaps in an
 * Alea stream seeded from the caller's own seeded rng and restores the
 * original in `finally` — no other system ever sees the swapped stream
 * (name generation is fully synchronous). Throws when the burg or
 * its culture can't be resolved - no fallback namer provided.
 */
export function getBurgNamer(
  worldSeed: number,
  burgId: number,
): (rng: { next(): number }) => string {
  try {
    const atlas = getBridgeAtlas(worldSeed);
    const burg = atlas.pack.burgs?.[burgId] as Burg | undefined;
    const cultureId = burg?.culture ?? 0;
    if (!atlas.pack.cultures?.[cultureId]) {
      throw new Error(`Cannot resolve culture ${cultureId} for burg ${burgId} in world ${worldSeed}`);
    }

    const key = worldforgeSeedString(worldSeed);
    let names = namerCache.get(key);
    if (!names) {
      names = new NamesGenerator(atlas.nameBases);
      names.pack = atlas.pack;
      namerCache.set(key, names);
    }
    const generator = names;

    return (rng) => {
      const saved = Math.random;
      (Math as { random: () => number }).random = Alea(`${key}:occupant:${rng.next()}`);
      try {
        return generator.getCulture(cultureId);
      } finally {
        Math.random = saved;
      }
    };
  } catch (error) {
    throw new Error(`Failed to create burg namer for burg ${burgId} in world ${worldSeed}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * FMG culture TYPE for a burg ('Highland' | 'Naval' | 'River' | 'Lake' |
 * 'Nomadic' | 'Hunting' | 'Generic') — drives the architecture style family
 * selected per town. No-fallback (project directive): throws if the burg or
 * its culture can't be resolved, same posture as getBurgNamer above.
 */
export function getBurgCultureType(worldSeed: number, burgId: number): string {
  const atlas = getBridgeAtlas(worldSeed);
  const burg = atlas.pack.burgs?.[burgId] as Burg | undefined;
  if (!burg) {
    throw new Error(`Cannot resolve burg ${burgId} in world ${worldSeed}`);
  }
  const cultureId = burg.culture ?? 0;
  const culture = atlas.pack.cultures?.[cultureId] as { type?: string } | undefined;
  if (!culture) {
    throw new Error(`Cannot resolve culture ${cultureId} for burg ${burgId} in world ${worldSeed}`);
  }
  if (!culture.type) {
    throw new Error(`Culture ${cultureId} has no type (burg ${burgId}, world ${worldSeed})`);
  }
  return culture.type;
}

// ============================================================================
// Burg Biome Resolution
// ============================================================================
// This section resolves the FMG biome ID for a specific burg. It is used to
// determine the climate class of a town (e.g. cold, arid, temperate, marsh)
// so that the 2D and 3D renderers can build identical climate-specific roof
// styles and eave features.
//
// What changed: Added getBurgBiomeId.
// Why it changed: To allow the 2D and 3D architectural style pipelines to resolve
// the same climate-aware building characteristics.
// What was preserved: Follows the same no-fallback throw posture as getBurgCultureType.
// ============================================================================

/**
 * FMG biome id for a burg — drives the climate class per town.
 * Throws when the burg or its cell biome can't be resolved (no-fallback).
 */
export function getBurgBiomeId(worldSeed: number, burgId: number): number {
  const atlas = getBridgeAtlas(worldSeed);
  const burg = atlas.pack.burgs?.[burgId] as Burg | undefined;
  if (!burg) {
    throw new Error(`Cannot resolve burg ${burgId} in world ${worldSeed}`);
  }
  const cellId = burg.cell;
  const biomeId = (atlas.pack.cells as any).biome?.[cellId];
  if (biomeId === undefined) {
    throw new Error(`Cannot resolve biome for cell ${cellId} (burg ${burgId}, world ${worldSeed})`);
  }
  return biomeId;
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
  touchWorldSeedCache(worldSeed);
  return atlas;
}

/**
 * Return the cached canonical atlas for a seed, or undefined. It never builds.
 *
 * Screens that build the atlas in the worker (useOffThreadBridgeAtlas, GG-555)
 * check this first. The worker install REPLACES the cached object, so a second
 * build would change the atlas identity under every consumer that already holds
 * it, and would waste the ~4.5 s build.
 */
export function peekBridgeAtlas(worldSeed: number): FmgWorldResult | undefined {
  return atlasCache.get(worldforgeSeedString(worldSeed));
}

/**
 * Install an atlas prepared by the browser worker into the existing canonical
 * per-seed cache.
 *
 * Structured clone cannot carry the runtime quadtree because it owns function
 * accessors. Rebuilding that lookup from the unchanged cell points restores the
 * same exact-cell behavior without regenerating or changing any world data.
 */
export function installPreparedBridgeAtlas(
  worldSeed: number,
  atlas: FmgWorldResult,
  transferProperties?: {
    gridPrecipitation?: ReadonlyArray<readonly [string, number]>;
  },
): FmgWorldResult {
  // Structured clone keeps every indexed typed-array value but omits custom
  // properties. Restore FMG's deterministic precipitation properties in their
  // original insertion order before exposing the atlas to any consumer.
  const precipitation = atlas.grid.cells.prec as unknown as Record<string, number>;
  for (const [key, value] of transferProperties?.gridPrecipitation ?? []) {
    precipitation[key] = value;
  }
  atlas.pack.cells.q = quadtree(
    atlas.pack.cells.p.map(([x, y], i) => [x, y, i] as number[]),
  );
  atlasCache.set(worldforgeSeedString(worldSeed), atlas);
  touchWorldSeedCache(worldSeed);
  return atlas;
}

/**
 * Map a legacy world-map tile to its anchoring atlas LAND cell.
 * Proportional projection, then nearest land cell by center distance
 * (linear scan — ~10k cells, sub-millisecond, no index needed).
 *
 * NOTE (cell-native world): the approved bridge spec proposed reimplementing
 * this as `legacyGridToAtlasCell + snapToLandCell` to unify the land rule with
 * the marker half. That was tried and reverted — it shifts `getTownTilesForGrid`
 * (FMG 960×540 projection vs graphWidth, and nearest-all+snap vs nearest-land),
 * breaking the town-tile mapping + pipeline round-trip. Kept as-is; the shared
 * `snapToLandCell` is still the single land-rule home for new cell-native paths.
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
  return nearestLandCellToPoint(atlas, px, py);
}

/** Nearest land cell to an atlas/graph pixel point (linear scan, land only). */
function nearestLandCellToPoint(atlas: FmgAtlasResult, px: number, py: number): number {
  const { cells } = atlas.pack;
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < cells.h.length; i++) {
    if (cells.h[i] < 20) continue; // land only — the submap is walkable ground
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

/**
 * The live burg (if any) a legacy grid tile opens onto. A tile "contains" a
 * burg when the burg's atlas position floor-projects into it (the algebraic
 * inverse of the tile-center convention). When several burgs share a tile the
 * one nearest the tile center wins (ties: lower id) — deterministic and purely
 * spatial, so the 2D grid, the town-tile inverse, and 3D entry all agree.
 */
export function burgForTile(
  atlas: FmgWorldResult,
  worldMapX: number,
  worldMapY: number,
  worldMapWidth: number,
  worldMapHeight: number,
): LiveBurg | null {
  const cols = Math.max(1, Math.floor(worldMapWidth));
  const rows = Math.max(1, Math.floor(worldMapHeight));
  const cxPx = ((worldMapX + 0.5) / cols) * FMG_WIDTH;
  const cyPx = ((worldMapY + 0.5) / rows) * FMG_HEIGHT;

  let best: LiveBurg | null = null;
  let bestDist = Infinity;
  for (const burg of atlas.pack.burgs ?? []) {
    if (!isLiveBurg(burg)) continue;
    const tile = projectedTileForAtlasPoint(burg.x, burg.y, cols, rows);
    if (tile.x !== worldMapX || tile.y !== worldMapY) continue;
    const dx = burg.x - cxPx;
    const dy = burg.y - cyPx;
    const d = dx * dx + dy * dy;
    if (d < bestDist || (d === bestDist && best !== null && burg.i < best.i)) {
      bestDist = d;
      best = burg;
    }
  }
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
/**
 * Cell-first Locale entrypoint (cell-native world, Stage 1). Builds the
 * region/local for an EXACT atlas cell — no grid round-trip — so "enter cell C"
 * anchors the 3D slice on C, not a coarse-grid neighbour. `anchorCellId` must be
 * a land cell (callers land-snap first via snapToLandCell where needed).
 */
export function getWorldforgeLocalForCell(
  worldSeed: number,
  anchorCellId: number,
  // When entering a settlement, pass the burg's atlas/graph PIXEL position so the
  // Locale window frames the town (cells are far larger than the window, and a
  // burg sits anywhere within its cell). Omit for wilderness (centers on site).
  opts: { centerPx?: readonly [number, number]; townLayouts?: TownLayoutStates; terrainRevision?: TerrainSourceRevision } = {},
): BridgeLocalResult {
  const atlas = getBridgeAtlas(worldSeed);

  const centerTag = opts.centerPx ? `@${Math.round(opts.centerPx[0])},${Math.round(opts.centerPx[1])}` : '';
  // Terrain is a separate saved source identity (ADR0013/0015). A town
  // layout must not silently select another generation system.
  const terrainTag = opts.terrainRevision === 1 ? '/terrain:pre-oct30' : '';
  const regionKey = `${worldforgeSeedString(worldSeed)}/cell:${anchorCellId}${centerTag}${terrainTag}`;
  let region = regionCache.get(regionKey);
  if (!region) {
    region = generateRegionFromSource(atlas, anchorCellId, rootSeedPath(worldSeed), {
      feetPerPixel: FEET_PER_FMG_PIXEL,
      resolutionFt: 100,
      world: atlas,
      windowCenterPx: opts.centerPx,
    }, opts.terrainRevision);
    regionCache.set(regionKey, region);
  }

  const biomeId = Number(
    (atlas.pack.cells as unknown as { biome?: ArrayLike<number> }).biome?.[anchorCellId] ?? 6,
  );

  const center = {
    x: region.bounds.x + region.bounds.width / 2,
    y: region.bounds.y + region.bounds.height / 2,
  };
  // Only source selection changes this cache identity. Daily family/news
  // updates must not rebuild terrain; a legacy plan must not inherit whichever
  // revision populated this region's Local cache first. Keep the current key.
  const selections = (region.townSites ?? []).map(site => [site.burgId,
    opts.townLayouts?.[site.burgId]?.layoutRevision ?? CURRENT_TOWN_LAYOUT_REVISION]);
  const layoutTag = selections.some(([, revision]) => revision !== CURRENT_TOWN_LAYOUT_REVISION)
    ? '/layouts:' + JSON.stringify(selections) : '';
  const localKey = `${regionKey}/local:${Math.round(center.x)}-${Math.round(center.y)}${layoutTag}`;
  let local = localCache.get(localKey);
  if (!local) {
    const generatedLocal = generateLocal(region, center, region.seedPath, { biomeId });
    const townSite = canonicalTownSiteForLocal(region, generatedLocal);
    // The L2 artifact owns the exact canonical plan whenever its window contains
    // a generated settlement. Ground uses the same Atlas-accepting adapter, so
    // plan ids, footprints, architecture, and display identity stay identical.
    local = townSite
      ? {
          ...generatedLocal,
          townPlan: canonicalArtifactTownForSiteFromAtlas(
            atlas,
            worldSeed,
            townSite,
            opts.townLayouts?.[townSite.burgId]?.layoutRevision,
          ).plan,
        }
      : generatedLocal;
    localCache.set(localKey, local);
  }

  return { local, region, anchorCellId, biomeId };
}

/**
 * Select the settlement represented by a Local window.
 *
 * Envelopes can overlap a 3,000 ft Local. The nearest overlapping burg wins,
 * with source id as the deterministic tie-breaker, which preserves room for
 * denser future settlement layouts without making array order into identity.
 */
export function canonicalTownSiteForLocal(
  region: RegionArtifact,
  local: Pick<LocalArtifact, 'bounds'>,
): RegionTownSite | undefined {
  const centerX = local.bounds.x + local.bounds.width / 2;
  const centerY = local.bounds.y + local.bounds.height / 2;
  const overlaps = (site: RegionTownSite): boolean =>
    site.envelope.x <= local.bounds.x + local.bounds.width &&
    site.envelope.x + site.envelope.width >= local.bounds.x &&
    site.envelope.y <= local.bounds.y + local.bounds.height &&
    site.envelope.y + site.envelope.height >= local.bounds.y;

  return region.townSites
    .filter(overlaps)
    .sort((a, b) => {
      const ax = a.envelope.x + a.envelope.width / 2;
      const ay = a.envelope.y + a.envelope.height / 2;
      const bx = b.envelope.x + b.envelope.width / 2;
      const by = b.envelope.y + b.envelope.height / 2;
      const aDistance = (ax - centerX) ** 2 + (ay - centerY) ** 2;
      const bDistance = (bx - centerX) ** 2 + (by - centerY) ** 2;
      return aDistance - bDistance || a.burgId - b.burgId;
    })[0];
}

/**
 * Grid-tile Locale entrypoint (legacy bookkeeping path). A thin wrapper that
 * recovers the anchor cell from a coarse grid tile (nearest-land), then defers
 * to {@link getWorldforgeLocalForCell}. Used for party-location / WF_TILE /
 * WF_TOWN entries that don't carry an exact cell.
 */
export function getWorldforgeLocalForLocation(
  worldSeed: number,
  worldMapX: number,
  worldMapY: number,
  worldMapWidth: number,
  worldMapHeight: number,
): BridgeLocalResult {
  const entry = resolveWorldforgeLocationEntry(worldSeed, worldMapX, worldMapY, worldMapWidth, worldMapHeight);
  return getWorldforgeLocalForCell(worldSeed, entry.cellId, entry.centerPx ? { centerPx: entry.centerPx } : {});
}

/** The atlas cell (and town-framing center) a legacy grid tile opens onto. */
export interface WorldforgeLocationEntry {
  cellId: number;
  /** The burg's atlas pixel position when the tile holds a town; else absent. */
  centerPx?: readonly [number, number];
}

/**
 * Resolve a legacy grid tile to the cell-addressed entry that
 * `getWorldforgeLocalForLocation` builds. It reads only the atlas, so it is
 * cheap. GG-558 (2026-11-01): the World3D demo resolves its `?gx/?gy` tile with
 * this on the main thread, and then sends the cell to the world-gen worker. The
 * region and ground build then run off the main thread, as in the game's entry.
 */
export function resolveWorldforgeLocationEntry(
  worldSeed: number,
  worldMapX: number,
  worldMapY: number,
  worldMapWidth: number,
  worldMapHeight: number,
): WorldforgeLocationEntry {
  const atlas = getBridgeAtlas(worldSeed);

  // Burg-aware tile entry (2026-07-02): a tile that visually contains burgs
  // opens onto the burg nearest its center, window centered ON the burg — the
  // same settlement mode as WF_TOWN / cell-addressed entry. Without this, a
  // burg rendered only when its own cell happened to be the tile's
  // nearest-land anchor: the 25k-ft window vs ~70k-ft cell spacing made that a
  // ~5% lottery, and whole culture families (every Highland burg in seeds 1234
  // and 2026) had zero live towns in ground mode.
  const burg = burgForTile(atlas, worldMapX, worldMapY, worldMapWidth, worldMapHeight);
  if (burg) {
    // Anchor on the cell actually at the burg's position — burg.cell can be
    // stale (see cellAddressedEntry.test.ts).
    return { cellId: nearestLandCellToPoint(atlas, burg.x, burg.y), centerPx: [burg.x, burg.y] };
  }

  return { cellId: legacyTileToAtlasCell(atlas, worldMapX, worldMapY, worldMapWidth, worldMapHeight) };
}

// ============================================================================
// Town Tile Inverse Mapping
// ============================================================================
// This section answers the opposite question from getWorldforgeLocalForLocation:
// given a legacy grid size, which tiles will open onto at least one FMG burg?
// It keeps the same proportional tile-center convention and confirms every
// candidate with legacyTileToAtlasCell so water-to-land snapping cannot drift.
// ============================================================================

export function townHalfExtentFt(burg: Burg): number {
  // Region generation sizes every town envelope from real people using the
  // canonical townScale helper (`townEnvelopeHalfFtForPeople(population * POPULATION_RATE)`).
  // Calling that same helper here keeps the inverse tile lookup aligned with
  // the actual region town envelope (floor 800 ft up to 3,200 ft half-extent)
  // so edge-overlapping towns are never missed by the legacy tile bridge.
  const population = burg.population ?? 10;
  return townEnvelopeHalfFtForPeople(population * POPULATION_RATE);
}

function isLiveBurg(burg: Burg | undefined): burg is LiveBurg {
  // FMG index 0 is a placeholder and editor-deleted burgs stay in the array.
  // Ground mode only receives burgs with a real id and no removal flag.
  return Boolean(burg?.i && !burg.removed);
}

function projectedTileForAtlasPoint(
  atlasX: number,
  atlasY: number,
  cols: number,
  rows: number,
): { x: number; y: number } {
  // This is the algebraic inverse of the forward tile-center projection:
  // px = ((x + 0.5) / cols) * FMG_WIDTH. Flooring the atlas proportion finds
  // the tile whose center is closest before the nearest-land snap is checked.
  return {
    x: Math.floor((atlasX / FMG_WIDTH) * cols),
    y: Math.floor((atlasY / FMG_HEIGHT) * rows),
  };
}

function clampedTileRange(center: number, radius: number, limit: number): [number, number] {
  // Bounded neighborhoods can spill past the map edge. Clamping preserves edge
  // tiles without inventing negative or out-of-grid legacy coordinates.
  return [
    Math.max(0, center - radius),
    Math.min(Math.max(0, limit - 1), center + radius),
  ];
}

function nearestLandNeighborDistancePx(
  atlas: FmgWorldResult,
  cellId: number,
  cache: Map<number, number>,
): number {
  // The candidate tile search radius scales with local cell spacing. This
  // avoids a full-grid brute-force pass while still covering fine legacy grids
  // where many tile centers can fall inside one land cell's snap territory.
  const cached = cache.get(cellId);
  if (cached !== undefined) return cached;

  const { cells } = atlas.pack;
  const origin = cells.p[cellId];
  let best = Infinity;
  for (let i = 0; i < cells.h.length; i++) {
    if (i === cellId || cells.h[i] < 20) continue;
    const point = cells.p[i];
    if (!point) continue;
    const dx = point[0] - origin[0];
    const dy = point[1] - origin[1];
    const distance = Math.hypot(dx, dy);
    if (distance < best) best = distance;
  }

  // A missing neighbor would mean a one-cell land world. The normal atlas has
  // thousands of land cells, but the fallback keeps the inverse bounded.
  const distance = Number.isFinite(best) ? best : Math.max(FMG_WIDTH, FMG_HEIGHT);
  cache.set(cellId, distance);
  return distance;
}

function anchorCanShowBurg(atlas: FmgWorldResult, anchorCellId: number, burg: Burg): boolean {
  // A local window is centered on the snapped anchor cell. The town appears if
  // its envelope overlaps that 3,000 ft local square. The region window is much
  // larger, so any local overlap also satisfies the region's burg-center gate.
  const anchor = atlas.pack.cells.p[anchorCellId];
  const halfReachFt = LOCAL_SIZE_FT / 2 + townHalfExtentFt(burg);
  const dxFt = Math.abs((burg.x - anchor[0]) * FEET_PER_FMG_PIXEL);
  const dyFt = Math.abs((burg.y - anchor[1]) * FEET_PER_FMG_PIXEL);
  return dxFt <= halfReachFt && dyFt <= halfReachFt;
}

function candidateAnchorCellsForBurg(atlas: FmgWorldResult, burg: Burg): number[] {
  // Burg positions live in FMG pixels. We invert the local-overlap test against
  // land cell centers to find every snapped anchor cell that could show this
  // town before checking which legacy tiles actually snap there.
  const reachPx = (LOCAL_SIZE_FT / 2 + townHalfExtentFt(burg)) / FEET_PER_FMG_PIXEL;
  const out: number[] = [];
  const { cells } = atlas.pack;
  for (let cellId = 0; cellId < cells.h.length; cellId++) {
    if (cells.h[cellId] < 20) continue;
    const point = cells.p[cellId];
    if (!point) continue;
    if (
      Math.abs(point[0] - burg.x) <= reachPx &&
      Math.abs(point[1] - burg.y) <= reachPx
    ) {
      out.push(cellId);
    }
  }
  return out;
}

export function getTownTilesForGrid(
  worldSeed: number,
  cols: number,
  rows: number,
): TownTileEntry[] {
  const safeCols = Math.max(1, Math.floor(cols));
  const safeRows = Math.max(1, Math.floor(rows));
  const cacheKey = `${worldforgeSeedString(worldSeed)}|${safeCols}x${safeRows}`;
  const cached = townTileCache.get(cacheKey);
  if (cached) {
    touchWorldSeedCache(worldSeed);
    return cached.map((entry) => ({ ...entry }));
  }

  const atlas = getBridgeAtlas(worldSeed);
  const tileHits = new Map<string, TownTileEntry>();
  const neighborDistanceCache = new Map<number, number>();
  const verifiedTileAnchors = new Map<string, number>();

  // Burg-claimed tiles (burg-aware forward path): every live burg projects
  // into exactly one tile, and entering that tile opens burg-centered on the
  // tile's winner. Winners mirror burgForTile exactly so the inverse never
  // promises a town the forward path won't show.
  const claimedTiles = new Map<string, LiveBurg>();
  for (const burg of atlas.pack.burgs ?? []) {
    if (!isLiveBurg(burg)) continue;
    const tile = projectedTileForAtlasPoint(burg.x, burg.y, safeCols, safeRows);
    const tileKey = `${tile.x},${tile.y}`;
    const cxPx = ((tile.x + 0.5) / safeCols) * FMG_WIDTH;
    const cyPx = ((tile.y + 0.5) / safeRows) * FMG_HEIGHT;
    const dist = (burg.x - cxPx) ** 2 + (burg.y - cyPx) ** 2;
    const current = claimedTiles.get(tileKey);
    if (!current) {
      claimedTiles.set(tileKey, burg);
      continue;
    }
    const currentDist = (current.x - cxPx) ** 2 + (current.y - cyPx) ** 2;
    if (dist < currentDist || (dist === currentDist && burg.i < current.i)) {
      claimedTiles.set(tileKey, burg);
    }
  }
  for (const [tileKey, winner] of claimedTiles) {
    const [x, y] = tileKey.split(',').map(Number);
    tileHits.set(`${tileKey}|${winner.i}`, {
      x,
      y,
      burgId: winner.i,
      name: winner.name ?? `Burg ${winner.i}`,
    });
  }

  for (const burg of atlas.pack.burgs ?? []) {
    if (!isLiveBurg(burg)) continue;

    for (const anchorCellId of candidateAnchorCellsForBurg(atlas, burg)) {
      const anchor = atlas.pack.cells.p[anchorCellId];
      const projected = projectedTileForAtlasPoint(anchor[0], anchor[1], safeCols, safeRows);
      const tileStepPx = Math.min(FMG_WIDTH / safeCols, FMG_HEIGHT / safeRows);
      const snapRadiusPx = nearestLandNeighborDistancePx(
        atlas,
        anchorCellId,
        neighborDistanceCache,
      );
      const searchRadius = Math.max(2, Math.ceil(snapRadiusPx / Math.max(tileStepPx, 1e-6)) + 2);
      const [minX, maxX] = clampedTileRange(projected.x, searchRadius, safeCols);
      const [minY, maxY] = clampedTileRange(projected.y, searchRadius, safeRows);

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const tileKey = `${x},${y}`;
          // Claimed tiles open burg-centered on their winner — the anchor-site
          // window this legacy pass verifies against no longer applies there.
          if (claimedTiles.has(tileKey)) continue;
          let snappedAnchor = verifiedTileAnchors.get(tileKey);
          if (snappedAnchor === undefined) {
            snappedAnchor = legacyTileToAtlasCell(atlas, x, y, safeCols, safeRows);
            verifiedTileAnchors.set(tileKey, snappedAnchor);
          }
          if (snappedAnchor !== anchorCellId) continue;
          if (!anchorCanShowBurg(atlas, snappedAnchor, burg)) continue;

          // One entry per burg per tile preserves future large-town overlaps:
          // callers can group by tile, but no burg identity is lost.
          tileHits.set(`${tileKey}|${burg.i}`, {
            x,
            y,
            burgId: burg.i,
            name: burg.name ?? `Burg ${burg.i}`,
          });
        }
      }
    }
  }

  const result = [...tileHits.values()].sort((a, b) =>
    a.y - b.y || a.x - b.x || a.burgId - b.burgId,
  );
  townTileCache.set(cacheKey, result);
  return result.map((entry) => ({ ...entry }));
}

/**
 * Return the number of entries held for `worldSeed` across each bridge cache
 * map (diagnostics/tests for GG-579).
 */
export function getBridgeCacheCountsForSeed(worldSeed: number): {
  atlas: number;
  region: number;
  local: number;
  townTiles: number;
  namer: number;
} {
  const seedStr = worldforgeSeedString(worldSeed);
  const regionAndLocalPrefix = `${seedStr}/`;
  const townTilePrefix = `${seedStr}|`;
  let region = 0;
  for (const key of regionCache.keys()) {
    if (key.startsWith(regionAndLocalPrefix)) region++;
  }
  let local = 0;
  for (const key of localCache.keys()) {
    if (key.startsWith(regionAndLocalPrefix)) local++;
  }
  let townTiles = 0;
  for (const key of townTileCache.keys()) {
    if (key.startsWith(townTilePrefix)) townTiles++;
  }
  return {
    atlas: atlasCache.has(seedStr) ? 1 : 0,
    region,
    local,
    townTiles,
    namer: namerCache.has(seedStr) ? 1 : 0,
  };
}

/** Test/dev hook: drop all cached worlds (e.g. between seeds in a session). */
export function clearBridgeCaches(): void {
  atlasCache.clear();
  regionCache.clear();
  localCache.clear();
  townTileCache.clear();
  namerCache.clear();
  recentWorldSeeds.length = 0;
  for (const listener of worldSeedCacheListeners) {
    listener.onClearAll();
  }
}
