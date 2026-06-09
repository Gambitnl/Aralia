/**
 * @file terrainTileMapping.ts
 * Small hit-testing helpers for the terrain mesh.
 *
 * The 3D terrain click path needs one place to turn a raycast hit into a tile
 * coordinate. Keeping that math in a separate utility makes the boundary
 * behavior testable without mounting the whole renderer, while preserving the
 * component-level click flow in TerrainMesh.tsx.
 */

export interface TerrainHitPoint {
  x: number;
  z: number;
}

export interface TerrainMapDimensions {
  width: number;
  height: number;
}

export interface TerrainTileCoordinates {
  x: number;
  y: number;
}

function clampToTileIndex(value: number, size: number): number {
  return Math.min(size - 1, Math.max(0, value));
}

/**
 * Convert a terrain hit point, already expressed in tile units, into the tile
 * coordinate used by battle-map data.
 *
 * The point comes from the raycast intersection on the 3D terrain mesh. We keep
 * the floor math, but clamp the result so tiny floating-point drift at the edges
 * cannot drop a click outside the playable grid.
 */
export function resolveTerrainTileCoordinates(
  hitPoint: TerrainHitPoint,
  dimensions: TerrainMapDimensions,
): TerrainTileCoordinates | null {
  if (!Number.isFinite(hitPoint.x) || !Number.isFinite(hitPoint.z)) {
    return null;
  }

  if (dimensions.width <= 0 || dimensions.height <= 0) {
    return null;
  }

  return {
    x: clampToTileIndex(Math.floor(hitPoint.x), dimensions.width),
    y: clampToTileIndex(Math.floor(hitPoint.z), dimensions.height),
  };
}
