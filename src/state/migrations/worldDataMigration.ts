// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 30/05/2026, 23:20:24
 * Dependents: None (Orphan)
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file worldDataMigration.ts
 * @description One-shot loader-side migration: backfills `MapData.worldData` for saves created
 * before WorldData v2 existed. Idempotent — safe to call on already-migrated saves.
 *
 * Why this is built this way:
 * - This provides backward compatibility with earlier save files by dynamically rebuilding
 *   the procedural world data on load if it's missing or outdated.
 * - By checking `mapData.worldData`'s version and presence, it serves as an idempotent
 *   safeguard that only generates once and then behaves as a fast no-op on subsequent loads.
 * - Standard defaults are used for Heights, Temperatures, Moisture, and Biomes if the
 *   v1 payload has sparse data, ensuring no type errors or runtime failures.
 *
 * Known limitations/deferred issues:
 * - Re-running the procedural pipeline takes slightly longer during load on legacy saves,
 *   but it only happens once and is instantly saved in the new v2 format on the next save.
 */

import type { MapData } from '@/types/world';
import { runWorldSim } from '@/services/worldSim';

/**
 * Migrates a MapData object to WorldData v2 if worldData is missing.
 */
export function migrateMapDataToWorldDataV2(mapData: MapData, worldSeed: number): MapData {
  // Idempotence check: if v2 already exists, return mapData immediately
  if (mapData.worldData && mapData.worldData.version === 2) {
    return mapData;
  }

  const { rows, cols } = mapData.gridSize;
  const biomeIds: string[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      biomeIds.push(mapData.tiles[y]?.[x]?.biomeId ?? 'plains');
    }
  }

  const az = mapData.azgaarWorld;
  // Reconstruct arrays from azgaarWorld or backfill with sensible baseline defaults
  const heights = az?.heights ?? new Array(rows * cols).fill(30);
  const temperatures = az?.temperatures ?? new Array(rows * cols).fill(15);
  const moisture = az?.moisture ?? new Array(rows * cols).fill(20);
  const templateId = az?.templateId ?? 'unknown';

  // Regenerate WorldData procedurally
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
