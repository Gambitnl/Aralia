/**
 * @file worldDataMigration.ts
 * One-shot loader-side migration: backfills `MapData.worldData` for saves created
 * before WorldData v2 existed. Idempotent — safe to call on already-migrated saves.
 *
 * Behavior:
 *   - If `mapData.worldData` exists with version === 2, return the same MapData object unchanged.
 *   - Otherwise, derive `WorldData` by running `runWorldSim` from the per-tile biomeIds and
 *     the legacy `azgaarWorld` payload (heights/temperatures/moisture/templateId). When
 *     `azgaarWorld` is missing entirely (very old saves), fall back to flat defaults
 *     (height=30, temp=15, moisture=20, templateId='unknown') so the migration still produces
 *     a valid WorldData and the player isn't stuck with a broken save.
 */
import type { MapData } from '@/types/world';
import { runWorldSim } from '@/services/worldSim';

export function migrateMapDataToWorldDataV2(mapData: MapData, worldSeed: number): MapData {
  if (mapData.worldData && mapData.worldData.version === 2) return mapData;

  const { rows, cols } = mapData.gridSize;
  const biomeIds: string[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      biomeIds.push(mapData.tiles[y]?.[x]?.biomeId ?? 'plains');
    }
  }

  const az = mapData.azgaarWorld;
  const heights = az?.heights ?? new Array(rows * cols).fill(30);
  const temperatures = az?.temperatures ?? new Array(rows * cols).fill(15);
  const moisture = az?.moisture ?? new Array(rows * cols).fill(20);
  const templateId = az?.templateId ?? 'unknown';

  const worldData = runWorldSim({
    seed: worldSeed,
    templateId,
    cols,
    rows,
    heights,
    temperatures,
    moisture,
    biomeIds,
  });

  return { ...mapData, worldData };
}
