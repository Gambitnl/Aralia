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
/**
 * Migrates a MapData object to WorldData v2 if worldData is missing.
 */
export declare function migrateMapDataToWorldDataV2(mapData: MapData, worldSeed: number): MapData;
