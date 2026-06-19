// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 18/06/2026, 03:31:31
 * Dependents: components/MapPane.tsx, hooks/actions/handleMovement.ts, types/world.ts, utils/world/index.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/world/worldGeographyAdapter.ts
 * Read-only adapter that describes legacy map tiles through the World project's
 * geography contract.
 *
 * Why this exists:
 * - World, Travel, Submap, save/load, and 3D entry still share legacy `MapData`
 *   fields directly. This adapter gives new work a stable source-level contract
 *   before any runtime consumers are rewired.
 * - The first runtime-facing slice stays pure: callers can build and apply
 *   discovery/current-marker mutations without changing movement or map
 *   rendering code yet.
 *
 * Deferred:
 * - `MapTile` does not contain native passability. Callers can pass canonical
 *   biome definitions or a temporary allow-list; otherwise legacy tiles remain
 *   assumed passable until the Travel-owned cell model supplies richer terrain
 *   rules.
 */

import type { WorldData } from '@/services/worldSim/types';
import type { PlayerGroundPosition, PlayerWorldPosition } from '@/types/state';
import type { Biome, MapData, MapTile } from '@/types/world';
import {
  METERS_PER_CELL,
  getTerrainHeight,
  gridCellCenterToWorldMeters,
} from '@/utils/worldCoords';

// -----------------------------------------------------------------------------
// Public contract types
// -----------------------------------------------------------------------------

export type WorldGeographyKind = 'legacy-tile' | 'azgaar-cell' | 'worldforge-cell';

export interface LegacyTileCoordinates {
  x: number;
  y: number;
}

export interface WorldGeographyId {
  kind: WorldGeographyKind;
  id: string;
  legacyTile?: LegacyTileCoordinates;
}

export type WorldGeographyPassabilitySource =
  | 'assumed-passable'
  | 'biome-registry'
  | 'biome-allow-list';

export interface WorldGeographyPassability {
  passable: boolean;
  source: WorldGeographyPassabilitySource;
}

export interface WorldGeographyPoint {
  id: WorldGeographyId;
  legacyTile?: LegacyTileCoordinates;
  cellId?: string;
  worldMeters?: { x: number; z: number };
  biomeId: string;
  locationId?: string;
  discovered: boolean;
  isPlayerCurrent: boolean;
  passability: WorldGeographyPassability;
}

export type WorldGeographySnapshotSource =
  | 'legacy-mapdata'
  | 'worlddata-v2'
  | 'azgaar-derived';

export interface WorldGeographySnapshot {
  source: WorldGeographySnapshotSource;
  seed?: number;
  templateId?: string;
  gridSize: { rows: number; cols: number };
  points: WorldGeographyPoint[];
  worldData?: WorldData;
}

export type WorldGeographyMutation =
  | {
      type: 'discover';
      target: WorldGeographyId;
    }
  | {
      type: 'set-current';
      target: WorldGeographyId;
      discoverTarget?: boolean;
    }
  | {
      type: 'clear-current';
    };

export interface WorldGeographyMutationResult {
  mapData: MapData;
  snapshot: WorldGeographySnapshot;
  changedLegacyTiles: LegacyTileCoordinates[];
}

export interface WorldGeography3DAnchor {
  point: WorldGeographyPoint;
  worldPosition: PlayerWorldPosition;
  groundPosition: PlayerGroundPosition;
  worldData: WorldData;
}

export interface WorldGeographyAdapter {
  fromMapData(mapData: MapData, options?: FromMapDataOptions): WorldGeographySnapshot;
  resolvePoint(
    snapshot: WorldGeographySnapshot,
    id: WorldGeographyId | string,
  ): WorldGeographyPoint | null;
  resolveLegacyTile(
    snapshot: WorldGeographySnapshot,
    coordinates: LegacyTileCoordinates,
  ): WorldGeographyPoint | null;
  resolveWorldData(snapshot: WorldGeographySnapshot): WorldData | null;
  resolve3DAnchor(
    snapshot: WorldGeographySnapshot,
    id: WorldGeographyId | string,
  ): WorldGeography3DAnchor | null;
  buildLegacyDiscoveryMutations(
    mapData: MapData,
    center: LegacyTileCoordinates,
    radius?: number,
  ): WorldGeographyMutation[];
  applyMutationsToMapData(
    mapData: MapData,
    mutations: readonly WorldGeographyMutation[],
    options?: FromMapDataOptions,
  ): WorldGeographyMutationResult;
}

export interface FromMapDataOptions {
  /**
   * Optional canonical biome registry. This is preferred when available because
   * it preserves each `Biome.passable` value instead of relying on an inferred
   * list of ids.
   */
  biomesById?: Readonly<Record<string, Pick<Biome, 'passable'>>>;

  /**
   * Optional allow-list for passable legacy biome ids when a canonical biome
   * registry is not available. Without either input, legacy tiles are treated as
   * passable because `MapTile` has no passability field.
   */
  passableBiomeIds?: ReadonlySet<string> | readonly string[];
}

// -----------------------------------------------------------------------------
// Legacy tile projection helpers
// -----------------------------------------------------------------------------

export function createLegacyTileId(x: number, y: number): WorldGeographyId {
  return {
    kind: 'legacy-tile',
    id: `legacy-tile:${x}:${y}`,
    legacyTile: { x, y },
  };
}

export function fromMapData(
  mapData: MapData,
  options: FromMapDataOptions = {},
): WorldGeographySnapshot {
  const passableBiomeIds = normalizePassableBiomeIds(options.passableBiomeIds);
  const passabilityContext = {
    biomesById: options.biomesById,
    passableBiomeIds,
  };
  const points = mapData.tiles.flatMap((row) =>
    row.map((tile) => projectLegacyTile(tile, passabilityContext)),
  );
  const worldData = mapData.worldData;

  return {
    source: worldData?.version === 2 ? 'worlddata-v2' : 'legacy-mapdata',
    seed: worldData?.seed,
    templateId: worldData?.templateId,
    gridSize: { ...mapData.gridSize },
    points,
    worldData,
  };
}

export function resolvePoint(
  snapshot: WorldGeographySnapshot,
  id: WorldGeographyId | string,
): WorldGeographyPoint | null {
  const targetId = typeof id === 'string' ? id : id.id;
  return snapshot.points.find((point) => point.id.id === targetId) ?? null;
}

export function resolveLegacyTile(
  snapshot: WorldGeographySnapshot,
  coordinates: LegacyTileCoordinates,
): WorldGeographyPoint | null {
  return (
    snapshot.points.find(
      (point) =>
        point.legacyTile?.x === coordinates.x && point.legacyTile.y === coordinates.y,
    ) ?? null
  );
}

export function resolveWorldData(snapshot: WorldGeographySnapshot): WorldData | null {
  return snapshot.worldData ?? null;
}

export function resolve3DAnchor(
  snapshot: WorldGeographySnapshot,
  id: WorldGeographyId | string,
): WorldGeography3DAnchor | null {
  const point = resolvePoint(snapshot, id);
  const worldData = resolveWorldData(snapshot);
  const legacyTile = point?.legacyTile;
  if (!point || !worldData || !legacyTile) {
    return null;
  }

  // Convert the persisted geography identity into the same world-meter frame
  // used by World3D. This anchors entry at the center of the legacy tile while
  // keeping the stable `WorldGeographyId` as the caller-facing identity.
  const worldMeters = gridCellCenterToWorldMeters(
    legacyTile.x,
    legacyTile.y,
    snapshot.gridSize.cols,
    snapshot.gridSize.rows,
  );
  const worldPosition: PlayerWorldPosition = {
    x: worldMeters.x,
    y: getTerrainHeight(worldMeters.x, worldMeters.z, worldData),
    z: worldMeters.z,
  };
  const groundPosition: PlayerGroundPosition = {
    tileX: legacyTile.x,
    tileY: legacyTile.y,
    xM: METERS_PER_CELL / 2,
    zM: METERS_PER_CELL / 2,
  };

  return {
    point,
    worldPosition,
    groundPosition,
    worldData,
  };
}

// -----------------------------------------------------------------------------
// Pure legacy mutation helpers
// -----------------------------------------------------------------------------
// These helpers describe discovery and current-marker changes in adapter terms.
// They return copied `MapData` rather than changing the caller's existing tile
// arrays, which lets movement code migrate later without changing behavior today.
// -----------------------------------------------------------------------------

export function createDiscoverMutation(
  target: WorldGeographyId,
): WorldGeographyMutation {
  return { type: 'discover', target };
}

export function createSetCurrentMutation(
  target: WorldGeographyId,
  options: { discoverTarget?: boolean } = {},
): WorldGeographyMutation {
  return {
    type: 'set-current',
    target,
    discoverTarget: options.discoverTarget ?? true,
  };
}

export function createClearCurrentMutation(): WorldGeographyMutation {
  return { type: 'clear-current' };
}

export function buildLegacyDiscoveryMutations(
  mapData: MapData,
  center: LegacyTileCoordinates,
  radius = 0,
): WorldGeographyMutation[] {
  const boundedRadius = Math.max(0, Math.floor(radius));
  const mutations: WorldGeographyMutation[] = [];

  // Walk the square reveal area used by current movement. Bounds are checked
  // here so future callers do not need to know the legacy grid dimensions.
  for (let y = center.y - boundedRadius; y <= center.y + boundedRadius; y++) {
    for (let x = center.x - boundedRadius; x <= center.x + boundedRadius; x++) {
      if (isLegacyTileInsideGrid(mapData, { x, y })) {
        mutations.push(createDiscoverMutation(createLegacyTileId(x, y)));
      }
    }
  }

  return mutations;
}

export function applyMutationsToMapData(
  mapData: MapData,
  mutations: readonly WorldGeographyMutation[],
  options: FromMapDataOptions = {},
): WorldGeographyMutationResult {
  const nextTiles = mapData.tiles.map((row) => row.map((tile) => ({ ...tile })));
  const changedLegacyTiles = new Map<string, LegacyTileCoordinates>();

  // Apply each adapter mutation to the copied legacy tiles. Unknown future
  // geography IDs are ignored for now because this helper only owns the legacy
  // compatibility path.
  for (const mutation of mutations) {
    switch (mutation.type) {
      case 'discover':
        setLegacyTileDiscovered(nextTiles, mutation.target, changedLegacyTiles);
        break;
      case 'set-current':
        clearCurrentMarkers(nextTiles, changedLegacyTiles);
        setLegacyTileCurrent(
          nextTiles,
          mutation.target,
          mutation.discoverTarget ?? true,
          changedLegacyTiles,
        );
        break;
      case 'clear-current':
        clearCurrentMarkers(nextTiles, changedLegacyTiles);
        break;
    }
  }

  const nextMapData: MapData = {
    ...mapData,
    gridSize: { ...mapData.gridSize },
    tiles: nextTiles,
  };

  return {
    mapData: nextMapData,
    snapshot: fromMapData(nextMapData, options),
    changedLegacyTiles: Array.from(changedLegacyTiles.values()),
  };
}

export const worldGeographyAdapter: WorldGeographyAdapter = {
  fromMapData,
  resolvePoint,
  resolveLegacyTile,
  resolveWorldData,
  resolve3DAnchor,
  buildLegacyDiscoveryMutations,
  applyMutationsToMapData,
};

// -----------------------------------------------------------------------------
// Internal projection details
// -----------------------------------------------------------------------------

function projectLegacyTile(
  tile: MapTile,
  passabilityContext: WorldGeographyPassabilityContext,
): WorldGeographyPoint {
  const id = createLegacyTileId(tile.x, tile.y);
  return {
    id,
    legacyTile: { x: tile.x, y: tile.y },
    biomeId: tile.biomeId,
    locationId: tile.locationId,
    discovered: tile.discovered,
    isPlayerCurrent: tile.isPlayerCurrent,
    passability: resolvePassability(tile.biomeId, passabilityContext),
  };
}

interface WorldGeographyPassabilityContext {
  biomesById?: FromMapDataOptions['biomesById'];
  passableBiomeIds: ReadonlySet<string> | null;
}

function resolvePassability(
  biomeId: string,
  passabilityContext: WorldGeographyPassabilityContext,
): WorldGeographyPassability {
  const canonicalBiome = passabilityContext.biomesById?.[biomeId];
  if (canonicalBiome) {
    return {
      passable: canonicalBiome.passable,
      source: 'biome-registry',
    };
  }

  const passableBiomeIds = passabilityContext.passableBiomeIds;
  if (!passableBiomeIds) {
    return { passable: true, source: 'assumed-passable' };
  }
  return {
    passable: passableBiomeIds.has(biomeId),
    source: 'biome-allow-list',
  };
}

function normalizePassableBiomeIds(
  passableBiomeIds: FromMapDataOptions['passableBiomeIds'],
): ReadonlySet<string> | null {
  if (!passableBiomeIds) {
    return null;
  }
  return passableBiomeIds instanceof Set
    ? passableBiomeIds
    : new Set(passableBiomeIds);
}

function isLegacyTileInsideGrid(
  mapData: MapData,
  coordinates: LegacyTileCoordinates,
): boolean {
  return (
    coordinates.y >= 0 &&
    coordinates.y < mapData.gridSize.rows &&
    coordinates.x >= 0 &&
    coordinates.x < mapData.gridSize.cols &&
    Boolean(mapData.tiles[coordinates.y]?.[coordinates.x])
  );
}

function setLegacyTileDiscovered(
  tiles: MapTile[][],
  target: WorldGeographyId,
  changedLegacyTiles: Map<string, LegacyTileCoordinates>,
): void {
  const coordinates = target.legacyTile;
  const tile = coordinates ? tiles[coordinates.y]?.[coordinates.x] : undefined;
  if (!coordinates || !tile || tile.discovered) {
    return;
  }

  tile.discovered = true;
  recordChangedLegacyTile(changedLegacyTiles, coordinates);
}

function setLegacyTileCurrent(
  tiles: MapTile[][],
  target: WorldGeographyId,
  discoverTarget: boolean,
  changedLegacyTiles: Map<string, LegacyTileCoordinates>,
): void {
  const coordinates = target.legacyTile;
  const tile = coordinates ? tiles[coordinates.y]?.[coordinates.x] : undefined;
  if (!coordinates || !tile) {
    return;
  }

  if (!tile.isPlayerCurrent) {
    tile.isPlayerCurrent = true;
    recordChangedLegacyTile(changedLegacyTiles, coordinates);
  }
  if (discoverTarget && !tile.discovered) {
    tile.discovered = true;
    recordChangedLegacyTile(changedLegacyTiles, coordinates);
  }
}

function clearCurrentMarkers(
  tiles: MapTile[][],
  changedLegacyTiles: Map<string, LegacyTileCoordinates>,
): void {
  for (const row of tiles) {
    for (const tile of row) {
      if (tile.isPlayerCurrent) {
        tile.isPlayerCurrent = false;
        recordChangedLegacyTile(changedLegacyTiles, { x: tile.x, y: tile.y });
      }
    }
  }
}

function recordChangedLegacyTile(
  changedLegacyTiles: Map<string, LegacyTileCoordinates>,
  coordinates: LegacyTileCoordinates,
): void {
  changedLegacyTiles.set(
    createLegacyTileId(coordinates.x, coordinates.y).id,
    coordinates,
  );
}
