/**
 * @file mapDataToWorldData.ts
 * Resolves gameplay `MapData` into the `WorldData` shape the 3D chunk streamer expects.
 *
 * Why this exists:
 * - PLAYING 3D mode must not cast `gameState.mapData` to `WorldData` — MapData is a wider
 *   save-game envelope (tiles, discovery, optional azgaarWorld) while WorldData is the
 *   worldSim heightfield artifact used by `handleChunkRequest` and terrain height lookup.
 * - Saves created before worldSim may lack `mapData.worldData`; the same migration used on
 *   load (`migrateMapDataToWorldDataV2`) is applied here so 3D entry works without mutating
 *   Redux state in the render path.
 *
 * Deferred:
 * - Persisting a freshly migrated `worldData` back into `gameState.mapData` on first 3D entry
 *   would avoid re-running migration each render until save; left for a follow-up dispatch.
 */

import type { WorldData } from '@/services/worldSim/types';
import type { MapData } from '@/types/world';
import { migrateMapDataToWorldDataV2 } from '@/state/migrations/worldDataMigration';

/**
 * Returns true when WorldData has the minimum fields required for chunk streaming and
 * bilinear height sampling (W3DUI-18 acceptance check).
 */
export function isWorldDataReadyForStreaming(
  data: WorldData | null | undefined,
): data is WorldData {
  if (!data || data.version !== 2) {
    return false;
  }
  const { rows, cols } = data.gridSize;
  if (!Number.isFinite(rows) || !Number.isFinite(cols) || rows <= 0 || cols <= 0) {
    return false;
  }
  const cellCount = rows * cols;
  const heights = data.heights;
  if (!Array.isArray(heights) || heights.length < cellCount) {
    return false;
  }
  return true;
}

/**
 * Extracts validated WorldData from MapData for PLAYING 3D mode.
 * Runs legacy migration when `worldData` is missing (idempotent when v2 already present).
 */
export function resolveWorldDataFor3D(
  mapData: MapData | null | undefined,
  worldSeed: number,
): WorldData | null {
  if (!mapData) {
    return null;
  }
  const migrated = migrateMapDataToWorldDataV2(mapData, worldSeed);
  const candidate = migrated.worldData;
  if (!isWorldDataReadyForStreaming(candidate)) {
    return null;
  }
  return candidate;
}
