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
  y?: number;
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

export interface TerrainTileResolutionOptions {
  sampleHeight?: (tileX: number, tileZ: number) => number;
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
  options: TerrainTileResolutionOptions = {},
): TerrainTileCoordinates | null {
  if (!Number.isFinite(hitPoint.x) || !Number.isFinite(hitPoint.z)) {
    return null;
  }

  if (dimensions.width <= 0 || dimensions.height <= 0) {
    return null;
  }

  if (Number.isFinite(hitPoint.y) && options.sampleHeight) {
    const baseX = Math.floor(hitPoint.x);
    const baseY = Math.floor(hitPoint.z);
    let best: TerrainTileCoordinates | null = null;
    let bestDistanceSq = Number.POSITIVE_INFINITY;

    for (let y = baseY - 1; y <= baseY + 1; y++) {
      for (let x = baseX - 1; x <= baseX + 1; x++) {
        const clampedX = clampToTileIndex(x, dimensions.width);
        const clampedY = clampToTileIndex(y, dimensions.height);
        const centerX = clampedX + 0.5;
        const centerZ = clampedY + 0.5;
        const centerY = options.sampleHeight(centerX, centerZ);
        if (!Number.isFinite(centerY)) continue;

        const dx = hitPoint.x - centerX;
        const dy = (hitPoint.y as number) - centerY;
        const dz = hitPoint.z - centerZ;
        const distanceSq = dx * dx + dy * dy + dz * dz;
        if (distanceSq < bestDistanceSq) {
          bestDistanceSq = distanceSq;
          best = { x: clampedX, y: clampedY };
        }
      }
    }

    if (best) return best;
  }

  return {
    x: clampToTileIndex(Math.floor(hitPoint.x), dimensions.width),
    y: clampToTileIndex(Math.floor(hitPoint.z), dimensions.height),
  };
}
