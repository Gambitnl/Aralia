// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 07:53:07
 * Dependents: components/Submap/SubmapPane.tsx, components/World3D/World3DDemo.tsx, components/World3D/World3DWrapper.tsx
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import { LOCAL_SIZE_FT } from "../units";
import type { LocalArtifact, RegionArtifact } from "../artifacts";
import type { Burg } from "../fmg/burgs-generator";
import { NamesGenerator } from "../fmg/names-generator";
import Alea from "alea";

/** FMG canvas the bridge generates against (the demo's standard frame). */
const FMG_WIDTH = 960;
const FMG_HEIGHT = 540;
const FMG_CELLS_DESIRED = 10000;
const FMG_TEMPLATE = "continents";

// â”€â”€ Module caches (one game world per session; keyed defensively anyway) â”€â”€
const atlasCache = new Map<string, FmgWorldResult>();
const regionCache = new Map<string, RegionArtifact>();
const localCache = new Map<string, LocalArtifact>();
const townTileCache = new Map<string, TownTileEntry[]>();
const namerCache = new Map<string, NamesGenerator>();

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
  opts: { centerPx?: readonly [number, number] } = {},
): BridgeLocalResult {
  const atlas = getBridgeAtlas(worldSeed);

  const centerTag = opts.centerPx ? `@${Math.round(opts.centerPx[0])},${Math.round(opts.centerPx[1])}` : '';
  const regionKey = `${worldforgeSeedString(worldSeed)}/cell:${anchorCellId}${centerTag}`;
  let region = regionCache.get(regionKey);
  if (!region) {
    region = generateRegion(atlas, anchorCellId, rootSeedPath(worldSeed), {
      feetPerPixel: FEET_PER_FMG_PIXEL,
      resolutionFt: 100,
      world: atlas,
      windowCenterPx: opts.centerPx,
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
  const atlas = getBridgeAtlas(worldSeed);
  const anchorCellId = legacyTileToAtlasCell(
    atlas, worldMapX, worldMapY, worldMapWidth, worldMapHeight,
  );
  return getWorldforgeLocalForCell(worldSeed, anchorCellId);
}

// ============================================================================
// Town Tile Inverse Mapping
// ============================================================================
// This section answers the opposite question from getWorldforgeLocalForLocation:
// given a legacy grid size, which tiles will open onto at least one FMG burg?
// It keeps the same proportional tile-center convention and confirms every
// candidate with legacyTileToAtlasCell so water-to-land snapping cannot drift.
// ============================================================================

function townHalfExtentFt(burg: Burg): number {
  // Region generation sizes every town envelope from population with the same
  // clamp. Mirroring that formula here lets the inverse include tiles where
  // only part of a town envelope overlaps the local ground window.
  const population = burg.population ?? 10;
  return Math.max(400, Math.min(4000, Math.sqrt(population) * 80));
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
  if (cached) return cached.map((entry) => ({ ...entry }));

  const atlas = getBridgeAtlas(worldSeed);
  const tileHits = new Map<string, TownTileEntry>();
  const neighborDistanceCache = new Map<number, number>();
  const verifiedTileAnchors = new Map<string, number>();

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

/** Test/dev hook: drop all cached worlds (e.g. between seeds in a session). */
export function clearBridgeCaches(): void {
  atlasCache.clear();
  regionCache.clear();
  localCache.clear();
  townTileCache.clear();
}

