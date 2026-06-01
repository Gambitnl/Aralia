# NORTH_STAR: WorldSim Service

Status: active
Last updated: 2026-06-01

> One of three distinct surfaces in the **Azgaar-driven streamed 3D world** initiative
> (not consolidated):
> - **this surface (`worldsim-service`)** — world **generation + simulation**: the spatial
>   geometry pipeline *and* the world's first-build history/story/events.
> - `world3d` — the 3D rendering engine that consumes this surface's `WorldData`.
> - `world-3d-ui` — the 2D↔3D transition + in-3D HUD.
> Owner: claude.

## Why This Project Exists

This is the owner of **how a world comes into being**: both its physical generation and the
simulation that produces its initial state and story at first build. Two halves:

1. **Spatial generation (built):** `src/services/worldSim` deterministically produces the
   `WorldData` v2 artifact (heightmap, biomes, rivers, roads, sites, coastlines, lakes) that
   the 3D rendering engine (`world3d`) and the 2D atlas consume. This is the "Plan 1" work.
2. **World story / history / events (growth area):** the narrative simulation that runs when
   a player first creates a character and the world is generated — the world's seeded history,
   founding events, and initial lore. `src/services/WorldHistoryService.ts` is the current
   seed of this; it is early and intended to grow under this surface.

Keeping both halves here makes "the world that gets generated at game start" a single owned
concern, so geometry and the world's story are versioned and reasoned about together.

## Purpose and Scope

In scope:
- The procedural world **geometry** pipeline + `WorldData` v2 contract (`src/services/worldSim/*`).
- World **snapshot** lifecycle: load, version, migrate (`worldDataMigration`, `saveLoadService`).
- **First-build world simulation**: generated history/story/events at world creation
  (`src/services/WorldHistoryService.ts` and its growth).
- The generation entry paths (`mapService.ts`, `azgaarDerivedMapService.ts`).

Out of scope (owned elsewhere):
- 3D rendering of `WorldData` — `world3d`.
- Entry/transition + HUD — `world-3d-ui`.
- **Ongoing/live** gameplay world-state churn after world birth (faction events over time,
  rumor systems, economy ticks) — stays under `docs/projects/world`. The boundary: this
  surface owns world **birth** (generation + initial story); `world` owns world **runtime**.

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


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
