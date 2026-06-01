# NORTH_STAR: WorldSim Service

Status: active
Last updated: 2026-05-31

## Why This Project Exists

`src/services/worldSim` is the single owner for generated world artifacts used as deterministic runtime geometry and navigation data. This project keeps that ownership explicit and records how world snapshots are loaded, versioned, and consumed by map and 3D systems.

## Purpose and Scope

- Owns the procedural world geometry pipeline contract (`WorldData` v2).
- Owns simulation ownership boundaries around world snapshots, migration, and sync/performance entry points.
- Does not own long-running gameplay simulation (faction events, rumor systems, economy updates), which stays under `docs/projects/world`.

## Key File Map

- `src/services/worldSim/index.ts` - orchestration for coastlines, lakes, biome zones, rivers, site placement, roads.
- `src/services/worldSim/types.ts` - canonical `WorldData` contract (v2), artifact schemas.
- `src/services/worldSim/constants.ts` - shared thresholds (for example `SEA_LEVEL`).
- `src/services/worldSim/coastlinesAndLakes.ts` - shoreline and basin lake extraction.
- `src/services/worldSim/rivers.ts` - flow tracing and river network generation.
- `src/services/worldSim/sites.ts` - deterministic site placement by seed.
- `src/services/worldSim/roads.ts` - A* and MST-based road generation.
- `src/services/worldSim/__tests__/*.test.ts` - deterministic outputs and structure checks.
- `src/services/worldSim/__tests__/pipeline.test.ts` - end-to-end pipeline assertions.
- `src/services/mapService.ts` and `src/services/azgaarDerivedMapService.ts` - generation entry paths.
- `src/state/migrations/worldDataMigration.ts` - backfills missing `MapData.worldData`.
- `src/services/saveLoadService.ts` - migration applied during load.
- `src/systems/world3d/chunkWorkerCore.ts`, `src/systems/world3d/chunkSampler.ts`, `src/systems/world3d/chunkStreamer.ts`, `src/components/World3D/*` - WorldData consumption in 3D streaming.

## Implemented State

- `runWorldSim(...)` returns a single deterministic `WorldData` object:
  - `version: 2`
  - seed/template metadata
  - full cell arrays: `heights`, `temperatures`, `moisture`, `biomeIds`
  - feature networks: `rivers`, `roads`, `sites`, `coastlines`, `lakes`, `biomeZones`
- `generateAzgaarDerivedMap(...)` builds azgaar-like inputs and flattens tile biomes before calling `runWorldSim`.
- `migrateMapDataToWorldDataV2(...)` rebuilds `worldData` when missing or stale, and is idempotent.
- `loadGame(...)` calls migration for legacy saves via `mapData`.
- 3D runtime consumes WorldData through a worker-backed chunk pipeline:
  - pure sample step (`chunkSampler.ts`) keeps geometry math testable
  - worker init/load protocol (`chunkWorker.ts`, `createWorkerChunkLoader.ts`)
  - streaming queue with throttling and distance window (`chunkStreamer.ts`, `WORLD3D_CONFIG`).

## World Snapshot, Loading, and Migration

- Snapshot payload is carried in `MapData.worldData`.
- Backward compatibility path:
  1. load map/save
  2. `migrateMapDataToWorldDataV2` reconstructs `worldData` from `azgaarWorld` or defaults
  3. regenerated data is used immediately for runtime and then saved as v2 in normal persistence flow.
- The legacy field `MapData.azgaarWorld` is marked deprecated but kept for migration safety.

## Sync and Performance Notes

- `runWorldSim` is synchronous; large maps can block generation on the caller thread.
- 3D geometry path is worker-oriented with transferable typed arrays for mesh payloads.
- Chunk streaming uses `LOAD_RADIUS`, `UNLOAD_RADIUS`, and `MAX_CONCURRENT_LOADS` to prevent churn/stutter.
- Road/rivers/sites are clipped per chunk during sample to keep per-load geometry bounded.

## Relationship to `docs/projects/world`

- `docs/projects/world` owns runtime simulation progression and world event/game-state behavior.
- `worldsim-service` owns the source-of-truth spatial artifact contract used by world systems that need terrain, features, and map features.
- Resume rule: do not move gameplay logic (daily loops, rumor handling, faction state) into this project.

## Current Gaps and Uncertainties

- Runtime performance envelope for very large map seeds is not fully measured (sync generation + migration fallback path).
- Migration behavior for future `WorldData` versions (v3+) is not defined yet.
- River/road and site features are generated but downstream render contracts are partially coupled to placeholder 3D mesh builders.

## Next Checks

1. Verify world snapshots for seeded reproducibility across map generation, save load, and replay.
2. Confirm migration no-op behavior when `worldData.version === 2`.
3. Validate chunk streaming and worker transfer behavior on large grids for peak memory and frame stability.
4. Confirm this project boundary against changes in `docs/projects/world` ownership docs.

## Resume Path

1. Read this file.
2. Read `docs/projects/worldsim-service/TRACKER.md`.
3. Read `docs/projects/worldsim-service/GAPS.md`.
4. Read `docs/projects/world/NORTH_STAR.md` for ownership boundary comparison.
