---
schema_version: 1
project: Worldsim Service
slug: worldsim-service
category: active project
main_category: "Game & Simulation"
subcategory: "World, Travel & Maps"
status: review-required
last_updated: 2026-06-08
confidence: unknown
evidence: "docs/projects/worldsim-service/TRACKER.md; docs/projects/worldsim-service/GAPS.md"
gap_signal: "WSS-005 review-required; WSS-006/WSS-007 remediated; WSS-008 remediated for bootstrap/save wiring"
protocol: living-project
next_step: "Do not assign WSS-005 forward implementation until source-of-truth review clears; WSS-008 is now closed and future birth-entry points should reuse the same bridge."
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
required_verification:
  - docs consistency
completed_verification:
  - docs refresh
  - focused worldSim + migration test runs
last_proof: 2026-06-08
workflow_gaps_reviewed: 2026-06-08
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "yes"
---
# NORTH_STAR: WorldSim Service

Status: review-required
Last updated: 2026-06-08 (WSS-008 remediated — bootstrap/save history bridge)

> One of three distinct surfaces in the **Azgaar-driven streamed 3D world** initiative
> (not consolidated):
> - **this surface (`worldsim-service`)** — world **generation + simulation**: the spatial
>   geometry pipeline *and* the world's first-build history/story/events.
> - `world3d` — the 3D rendering engine that consumes this surface's `WorldData`.
> - `world-3d-ui` — the 2D↔3D transition + in-3D HUD.
> Owner: claude.

## Dashboard Card Schema

| Field | Value |
|---|---|
| Project | Worldsim Service |
| Slug | worldsim-service |
| Category | active project |
| Status | review-required |
| Confidence | unknown |
| Evidence | docs/projects/worldsim-service/TRACKER.md; docs/projects/worldsim-service/GAPS.md |
| Gap signal | WSS-005 review-required; WSS-006/WSS-007 remediated; WSS-008 remediated for bootstrap/save wiring |
| Protocol | living-project |
| Next step | Do not assign WSS-005 forward implementation until source-of-truth review clears; WSS-008 is now closed and future birth-entry points should reuse the same bridge. |
| Required verification | docs consistency |
| Completed verification | docs refresh, focused worldSim + migration test runs |
| Last proof | 2026-06-08 first-build history, bootstrap/save bridge, climate fallback, and WSS-007 smoothing tests |
| Workflow gaps reviewed | 2026-06-08 |

## Required Review Brief

Decision needed: choose the feature source of truth for 2D atlas features and 3D `WorldData` features.

Issue: WSS-005 is review-required because Azgaar `azgaarWorld.rivers` and `runWorldSim` `traceRivers` diverge for a fixed seed, so downstream systems cannot safely assume one canonical river/site/road contract.

Why agents stop: forward implementation would silently bless either Azgaar features or `WorldData` features without an owner decision.

Decision owner: human/product owner with world generation, world rendering, and atlas owners.

Options:
- Consume Azgaar feature hints into `WorldData` so the 3D contract follows atlas features.
- Make the 2D atlas consume `WorldData` so generated gameplay/world features become canonical.

Evidence: `src/services/worldSim/__tests__/featureSourceTruth.test.ts`, `src/services/azgaarDerivedMapService.ts`, and `src/services/worldSim/index.ts`.

After decision: update WSS-005 and add a bridge-spec proof before assigning source-of-truth implementation.

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
- `src/services/worldSim/heightFromBiomes.ts` and `src/services/worldSim/climateFromBiomes.ts` - deterministic biome-derived fallback relief and climate.
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
- `migrateMapDataToWorldDataV2(...)` rebuilds `worldData` when missing or stale, backfills biome-derived heights + climate when Azgaar data is absent, and is idempotent.
- `loadGame(...)` calls migration for legacy saves via `mapData` and backfills an empty world-history shell when the save predates the bridge.
- 3D runtime consumes WorldData through a worker-backed chunk pipeline:
  - pure sample step (`chunkSampler.ts`) keeps geometry math testable
  - worker init/load protocol (`chunkWorker.ts`, `createWorkerChunkLoader.ts`)
  - streaming queue with throttling and distance window (`chunkStreamer.ts`, `WORLD3D_CONFIG`).

## World Snapshot, Loading, and Migration

- Snapshot payload is carried in `MapData.worldData`.
- Backward compatibility path:
  1. load map/save
  2. `migrateMapDataToWorldDataV2` reconstructs `worldData` from `azgaarWorld` or biome-derived fallbacks
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
- **WSS-004 (REMEDIATED 2026-06-02):** the `generateLegacyMap` fallback omits `azgaarWorld`/`worldData`, so migration previously backfilled flat constant heights → a featureless flat 3D world. **Fixed (policy A — derive from biomes):** `src/services/worldSim/heightFromBiomes.ts` maps each cell's biome `elevation` band → height + seeded jitter (deterministic per seed); `migrateMapDataToWorldDataV2` calls it instead of `fill(30)`. Provenance literal renamed `flat-backfill`→`biome-derived` (`world.ts`/`world.d.ts`/`DebugHUD.tsx`), still flagged amber as lower-fidelity. Empirical proof: real `generateMap` legacy-fallback now yields heights `distinct=38 min=25 max=88` (was constant 30). Remediated 2026-06-08 by adding deterministic smoothing to the biome-derived height pass. WSS-006 was remediated 2026-06-08 via biome-derived climate fields.
- **WSS-005 (REVIEW-REQUIRED 2026-06-08):** 2D atlas rivers (Azgaar's `azgaarWorld.rivers`) and 3D rivers (`runWorldSim` `traceRivers`) come from different algorithms and diverge for a fixed seed in `featureSourceTruth.test.ts`; source of truth is undecided.
- **WSS-008 (REMEDIATED 2026-06-08):** `WorldHistoryService.createFirstBuildHistory(...)` now emits a deterministic seeded first-build history contract and `useGameInitialization`/`START_GAME_SUCCESS`/`START_GAME_FOR_DUMMY` carry it into `GameState`. `saveLoadService.loadGame(...)` backfills an empty history shell for legacy saves that predate the bridge.

## Global Gap Imports

Triage of `docs/projects/GLOBAL_GAPS.md` for gaps belonging to this surface (world
generation + first-build simulation).

| Date checked | Reviewed rows | Imported | Decision |
|---|---|---|---|
| 2026-06-02 | GG-1..GG-15 + physical-object registry note | none | None pertain to world generation/simulation. GG-1 (character data import), GG-2/3 (economy), GG-5..GG-13 (character/combat/inventory/racial), GG-10/11 (character/inventory), GG-14 (canvas test infra), GG-15 (Ollama proxy) are owned elsewhere. GG-16/GG-17 were *authored* here during this pass but are cross-cutting tooling/type-hygiene issues, left in GLOBAL_GAPS for their owners. |

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
