// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 10:08:05
 * Dependents: components/BattleMap/terrain/TerrainMesh.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file terrain/terrainPointer.ts
 * Pointer-to-tile resolution for the terrain heightfield.
 *
 * Extracted from TerrainMesh.tsx (task agora-b70d). Click and hover both take
 * a world-space intersection point and have to answer the same question —
 * "which tile is under this?" — with the same height-aware, edge-clamped
 * resolution. Keeping both factories here means the two paths cannot drift.
 *
 * Behavior is unchanged: same clamping rationale, same hover dedupe, same
 * early returns.
 *
 * Dependencies: three, types/combat, ./terrainTileMapping, ./terrainGeometry
 * Dependents: terrain/TerrainMesh.tsx
 */

import type * as THREE from "three";
import type { BattleMapData, BattleMapTile } from "../../../types/combat";
import { resolveTerrainTileCoordinates } from "./terrainTileMapping";
import { TILE_SIZE } from "./terrainGeometry";

export interface TerrainTileResolverOptions {
  mapData: BattleMapData;
  width: number;
  height: number;
  /** Height sampler used to disambiguate steeply displaced surfaces. */
  sampleHeight: (x: number, z: number) => number;
}

/**
 * Resolve a world-space point to the map tile beneath it.
 *
 * The mesh can produce tiny floating-point drift at map edges when the ray
 * lands on a steeply displaced surface. `resolveTerrainTileCoordinates` clamps
 * the derived tile coordinate so valid edge clicks do not fall out of bounds.
 *
 * Returns null when the point resolves outside the board.
 */
export const resolveTileAtPoint = (
  point: THREE.Vector3,
  { mapData, width, height, sampleHeight }: TerrainTileResolverOptions
): BattleMapTile | null => {
  const tileCoords = resolveTerrainTileCoordinates(
    { x: point.x / TILE_SIZE, y: point.y, z: point.z / TILE_SIZE },
    { width, height },
    { sampleHeight },
  );
  if (!tileCoords) return null;
  return mapData.tiles.get(`${tileCoords.x}-${tileCoords.y}`) ?? null;
};

/**
 * Hover resolver that fires its callback once per tile crossing rather than on
 * every pointermove event.
 *
 * The dedupe state lives in the returned closure, so the caller keeps one
 * instance per mesh (TerrainMesh memoizes it) and does not need its own ref.
 */
export const createHoverTileResolver = (
  options: TerrainTileResolverOptions,
  onTileHover: (tile: BattleMapTile) => void
): ((point: THREE.Vector3 | undefined) => void) => {
  const { mapData, width, height, sampleHeight } = options;
  let lastHoverTileId: string | null = null;

  return (point) => {
    if (!point) return;
    const tileCoords = resolveTerrainTileCoordinates(
      { x: point.x / TILE_SIZE, y: point.y, z: point.z / TILE_SIZE },
      { width, height },
      { sampleHeight },
    );
    if (!tileCoords) return;
    const tileId = `${tileCoords.x}-${tileCoords.y}`;
    /* Dedupe on the RESOLVED COORDINATE, not on a found tile: a coordinate
     * that resolves to no tile still counts as a crossing, exactly as before
     * the split. Deduping after the lookup would re-fire the callback every
     * pointermove while the cursor sits over a hole in the tile map. */
    if (lastHoverTileId === tileId) return;
    lastHoverTileId = tileId;
    const tile = mapData.tiles.get(tileId);
    if (tile) onTileHover(tile);
  };
};
