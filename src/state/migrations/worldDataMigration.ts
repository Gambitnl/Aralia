// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/06/2026, 03:23:31
 * Dependents: services/mapService.ts, services/saveLoadService.ts, utils/mapDataToWorldData.ts
 * Imports: 5 files
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
 * - When Azgaar terrain is absent, the fallback path now derives both relief and climate from
 *   the biome ids instead of flattening the world to constants. That keeps legacy saves and
 *   generator fallbacks readable without pretending they are full-fidelity Azgaar outputs.
 *
 * Known limitations/deferred issues:
 * - Re-running the procedural pipeline takes slightly longer during load on legacy saves,
 *   but it only happens once and is instantly saved in the new v2 format on the next save.
 */

import type { MapData } from '@/types/world';
import { runWorldSim } from '@/services/worldSim';
import { heightFromBiomes } from '@/services/worldSim/heightFromBiomes';
import { climateFromBiomes } from '@/services/worldSim/climateFromBiomes';

/**
 * Migrates a MapData object to WorldData v2 if worldData is missing.
 */
export function migrateMapDataToWorldDataV2(mapData: MapData, worldSeed: number): MapData {
  // Idempotence check: if v2 worldData already exists, the save is current.
  // Grid retirement: the `worldGeography` snapshot is no longer backfilled — it
  // was a mapData.tiles-derived compatibility bridge that nothing reads (the
  // continent-3D path that needed it is deleted). Old saves keep the field
  // harmlessly; new ones omit it.
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
  // Reconstruct arrays from azgaarWorld, or — when no Azgaar terrain exists (legacy save or the
  // legacy-generator fallback) — DERIVE a real heightfield from the per-cell biomes instead of
  // backfilling a constant. The old behaviour silently shipped a flat pancake in 3D (WSS-004);
  // `heightFromBiomes` gives band-correlated relief (mountains high, oceans below sea level) that
  // is deterministic for a given seed. Track this so the DebugHUD reflects the true (coarser) source.
  const usedBiomeDerivedHeights = !az?.heights;
  const heights = az?.heights ?? heightFromBiomes(biomeIds, cols, rows, worldSeed);
  const derivedClimate = climateFromBiomes(biomeIds, cols, rows, worldSeed);
  const temperatures = az?.temperatures ?? derivedClimate.temperatures;
  const moisture = az?.moisture ?? derivedClimate.moisture;
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

  const migrated: MapData = { ...mapData, worldData };

  // Record provenance only when we derived heights from biomes (no Azgaar terrain), and only if a
  // generator upstream (e.g. mapService legacy fallback) has not already recorded a more specific
  // reason. This is lower-fidelity than the Azgaar path, so it stays flagged in the DebugHUD.
  if (usedBiomeDerivedHeights && !migrated.generation) {
    migrated.generation = {
      source: 'biome-derived',
      reason:
        'No Azgaar terrain available (legacy save or fallback map) — heightfield derived from biome elevation bands.',
      at: Date.now(),
    };
  }

  return migrated;
}
