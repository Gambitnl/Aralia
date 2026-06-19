---
schema_version: 1
project: World
slug: world
category: completed project
main_category: "Game & Simulation"
subcategory: "World, Travel & Maps"
status: complete for World-owned scope
last_updated: 2026-06-18
iteration: 16
confidence: medium
evidence: "docs/projects/world/TRACKER.md; docs/projects/world/GAPS.md; docs/projects/world/WORLD_GEOGRAPHY_ADAPTER_CONTRACT.md; src/utils/world/worldGeographyAdapter.ts; src/utils/world/__tests__/worldGeographyAdapter.test.ts; src/hooks/actions/handleMovement.ts; src/hooks/actions/__tests__/handleMovement.test.ts; src/hooks/actions/handleWorldEvents.ts; src/components/MapPane.tsx; src/components/__tests__/MapPane.test.tsx; src/state/__tests__/appState.worldGeographySnapshot.test.ts; src/state/__tests__/appState.worldStateShape.test.ts; src/state/reducers/worldReducer.ts; src/state/reducers/__tests__/worldReducer.test.ts; src/state/migrations/worldDataMigration.ts; src/state/migrations/__tests__/worldDataMigration.test.ts; src/systems/world/WorldEventManager.ts; src/types/world.ts; src/types/state.ts; src/state/appState.ts; src/state/initialState.ts; src/services/worldSim/types.ts; docs/projects/travel/GAPS.md; docs/projects/events/GAPS.md; docs/projects/memory/GAPS.md; docs/projects/town-description-system/GAPS.md"
gap_signal: "0 open gaps; World-owned gaps are resolved or routed. Remaining related work belongs to WorldSim Service WSS-001, Travel G6-G10, Submap G9-G12, and Global GG-29 owner lanes."
protocol: living-project
next_step: No active World-owned task remains; resume in the owner project named by any routed gap.
agent_comments: ""
active_agent: "Codex application agent (GPT-5)"
agent_pass_status: finished
agent_pass_started_at: "2026-06-18T04:22:38.1137062+02:00"
agent_pass_ended_at: "2026-06-18T04:30:25.2563096+02:00"
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
  - WORLD_GEOGRAPHY_ADAPTER_CONTRACT.md
required_verification:
  - docs consistency
completed_verification:
  - docs_consistency
  - focused_tests
  - adapter_design
  - source_adapter_tests
  - mutation_helper_tests
  - movement_wiring_tests
  - MapPane_read_wiring_tests
  - startup_load_snapshot_tests
  - passability_adapter_tests
  - migration_persistence_tests
  - 3D_anchor_conversion_tests
  - world_state_shape_tests
  - reducer_payload_contract_tests
  - schedule_proximity_boundary_audit
  - deterministic_daily_world_log_id_tests
  - worldsim_performance_owner_route
  - final_grid_retirement_owner_route
last_proof: 2026-06-18
workflow_gaps_reviewed: 2026-06-18
compaction_status: not_needed
lifecycle_status: complete_for_world_owned_scope
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# World System North Star

Status: complete for World-owned scope (all World gaps resolved or routed)
Last updated: 2026-06-18

## Dashboard Card Schema

| Field | Value |
|---|---|
| Project | World |
| Slug | world |
| Category | completed project |
| Status | complete for World-owned scope (all World gaps resolved or routed) |
| Confidence | medium |
| Evidence | docs/projects/world/TRACKER.md; docs/projects/world/GAPS.md; docs/projects/world/WORLD_GEOGRAPHY_ADAPTER_CONTRACT.md; src/utils/world/worldGeographyAdapter.ts; src/utils/world/__tests__/worldGeographyAdapter.test.ts; src/hooks/actions/handleMovement.ts; src/hooks/actions/__tests__/handleMovement.test.ts; src/hooks/actions/handleWorldEvents.ts; src/components/MapPane.tsx; src/components/__tests__/MapPane.test.tsx; src/state/__tests__/appState.worldGeographySnapshot.test.ts; src/state/__tests__/appState.worldStateShape.test.ts; src/state/reducers/worldReducer.ts; src/state/reducers/__tests__/worldReducer.test.ts; src/state/migrations/worldDataMigration.ts; src/state/migrations/__tests__/worldDataMigration.test.ts; src/systems/world/WorldEventManager.ts; src/types/world.ts; src/types/state.ts; src/state/appState.ts; src/state/initialState.ts; src/services/worldSim/types.ts; docs/projects/travel/GAPS.md; docs/projects/events/GAPS.md; docs/projects/memory/GAPS.md; docs/projects/town-description-system/GAPS.md |
| Gap signal | 0 open gaps; World-owned gaps are resolved or routed. Remaining related work belongs to WorldSim Service WSS-001, Travel G6-G10, Submap G9-G12, and Global GG-29 owner lanes. |
| Protocol | living-project |
| Next step | No active World-owned task remains; resume in the owner project named by any routed gap. |
| Required verification | docs consistency |
| Completed verification | docs consistency; focused tests; adapter design; source adapter tests; mutation helper tests; movement wiring tests; MapPane read wiring tests; startup/load snapshot tests; passability adapter tests; migration persistence tests; 3D anchor conversion tests; world-state shape tests; reducer payload contract tests; schedule/proximity boundary audit; deterministic daily-world log ID tests; worldSim performance owner route; final grid retirement owner route |
| Last proof | 2026-06-18 T18 final grid-retirement owner route |
| Workflow gaps reviewed | 2026-06-18 |

Dashboard lifecycle: complete_for_world_owned_scope
Assignment rule: Do not assign forward runtime changes until `MapData` tile-grid movement, save/load, and migration compatibility dependencies are explicitly preserved or routed. Update (2026-06-10): the G3 decision is recorded (Option B â€” DECISION_BLITZ D2); forward runtime work is assignable only through the new-contract-plus-adapters lane, and tile-grid fields stay canonical until every dependency has an explicit adapter.

## Required Review Brief

Title: Tile-grid world-map phase-out contract
Question: Which tile-grid `MapData` gameplay contracts must remain canonical while Azgaar, worldSim, and 3D/world-render paths replace the old world-map renderer?
Issue: The tile-grid world map is being phased out as a renderer, but its data contract still carries movement semantics, passability, discovery/current tile markers, startup/load continuity, migration compatibility, and 3D marker anchors.
Current behavior: `MapPane`, `handleMovement`, `MapData`, app setup/load flows, and `worldDataMigration` still preserve tile-grid world data even as newer geography and rendering paths expand.
Why blocked: Forward world-runtime agents could accidentally remove or bypass tile-grid fields that gameplay and save/load still depend on, so runtime edits must stop until the preservation contract is explicit.
Option A: Keep tile-grid `MapData` as the canonical gameplay compatibility layer and adapt new renderers/world data around it.
Option B: Promote a new canonical world geography contract and create an explicit migration/adapter layer for every tile-grid dependency before retiring old fields.
Evidence: `docs/projects/world/GAPS.md` G3; `src/components/MapPane.tsx`; `src/hooks/actions/handleMovement.ts`; `src/types/world.ts`; `src/state/appState.ts`; `src/state/migrations/worldDataMigration.ts`; `src/hooks/useGameInitialization.ts`.
Decision owner: Human/product owner plus world, map, save/load, and 3D/world-render owners.
Proof after decision: Contract preservation table plus focused startup/load/movement verification proving passability, current/discovered markers, migration, and 3D marker anchors still work.

### Decision (2026-06-10)

Outcome: **Option B â€” promote a new canonical world-geography contract and create an explicit migration/adapter layer for every tile-grid dependency before retiring old fields.** The new contract aligns with the Azgaar-based proc-gen pipeline (Azgaar is canonical per WorldSim Service D1). Required adapters cover, at minimum: movement, passability, discovery/current-tile markers, save/load/migration compatibility, and 3D marker anchors. Tile-grid `MapData` fields are not removed until each dependency has a working adapter and verification.
Decider: Remy (project owner), batched decision session (June 2026 proc-gen campaign context â€” see the master record's Context section).
Record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D2).
Effect: the G3 review gate is lifted and the World-owned adapter lane is closed. The first contract preservation table now lives in `TRACKER.md` under `Contract Preservation Table`, the concrete adapter design lives in `WORLD_GEOGRAPHY_ADAPTER_CONTRACT.md`, the read/mutation source adapter lives in `src/utils/world/worldGeographyAdapter.ts`, movement writes route through it, `MapPane.tsx` reads marker state through adapter-projected tiles, T9 proves startup/load payloads can produce seeded snapshots, T10 proves canonical biome plus allow-list passability through the adapter, T11 persists `worldGeography` during migration while preserving legacy `MapData`, and T12 resolves persisted geography points into World3D entry anchors. Final tile-grid retirement still belongs to G11/GG-29 plus Travel/Submap owner lanes.

## Why This Project Exists

Aralia has a narrow town-description surface in `docs/projects/town-description-system`, but the broader world runtime is owned by `src/systems/world` plus `src/services/worldSim`, `src/state` integration, and shared types. This project preserves that broader system so world generation, factions, simulation events, and geography state are not collapsed into a narrower town scope.

## Purpose

Provide a cold-start map of implemented world-state ownership and open gaps around the world simulation contract, so future work can continue at the right boundaries.

## Implemented Scope Map

- Core loop: `src/systems/world/WorldEventManager.ts` owns daily simulation. It runs rumor propagation, economy event cleanup, route processing, weighted random events, quest deadline checks, bounty hunter spawns, regional economics updates, faction daily economy updates, and courier delivery.
- Faction services:
  - `src/systems/world/FactionManager.ts` for reputation ripple and rumor generation.
  - `src/systems/world/FactionEconomyManager.ts` for treasury/route competition/policy logic.
  - `src/systems/world/NobleIntrigueManager.ts` for noble-house intrigue events.
- Time/state coupling:
  - `src/state/reducers/worldReducer.ts` processes `ADVANCE_TIME` daily pipeline and appends logs from world simulation.
  - `src/state/appState.ts` initializes/rebuilds `factions`, `playerFactionStandings`, `worldSeed`, and `mapData` on setup/load flows.
  - `src/state/initialState.ts` seeds world-facing runtime state (`factions`, `worldHistory`, `activeRumors`, `worldBusinesses`, `pendingCouriers`, etc).
- World generation and migration:
  - `src/services/worldSim/index.ts` produces `WorldData` v2 (procedural outputs: rivers, roads, sites, biome zones, coasts, lakes).
  - `src/services/worldSim/types.ts` defines the canonical `WorldData` contract.
  - `src/state/migrations/worldDataMigration.ts` migrates old `mapData` shapes to include `worldData` and is used on save load flows.
- State/types:
  - `src/types/world.ts` defines `MapData`, `WorldRumor`, geography and rumor spread fields.
  - `src/types/state.ts` defines world-facing state contract including `activeRumors`, `worldHistory`, `factions`, and `playerFactionStandings`.
- Movement/world hooks:
  - `src/hooks/actions/handleMovement.ts` advances world time and triggers `handleGossipEvent`.
  - `src/hooks/actions/handleWorldEvents.ts` implements background gossip and long-rest world-memory decay.

## Implemented Evidence

- World state is simulated from player time progression through `ADVANCE_TIME` in `worldReducer.ts`.
- Dynamic rumor lifecycle exists in `WorldEventManager` and is persisted in `GameState.activeRumors`.
- Faction economy and diplomacy are actively mutated from the daily loop and exposed via `playerFactionStandings`.
- `worldDataMigration` already handles missing/legacy `MapData` by regenerating `worldData` with `runWorldSim(...)`.
- `MapPane`, `handleMovement`, `MapData`, app state setup/load flows, and `worldDataMigration` still preserve tile-grid world data while Azgaar/3D rendering paths replace the old world-map renderer.
- The 2026-06-18 gap pass closed stale weather/economy casting gaps in `WorldEventManager`: current source reads `state.environment` and typed `state.economy.activeEvents`; focused WorldEventManager/worldReducer tests pass.
- The explicit G3 adapter contract rows are now source-proven for World. Final tile-grid retirement remains out of this World slice until G11/GG-29, Travel, and Submap owner lanes close their side.
- `WORLD_GEOGRAPHY_ADAPTER_CONTRACT.md` defines the concrete adapter design and stop conditions; `worldGeographyAdapter.ts` now covers read projection plus pure discovery/current-marker mutation helpers, and `handleMovement.ts` uses those helpers for marker writes.
- T13 made `activeRumors` and `worldHistory` mandatory on `GameState`, seeded fresh state and factory state with concrete defaults, and heals legacy loaded saves that omit rumor/history/notification/merchant UI fields.
- T14 removed the `SET_MAP_DATA` and `UPDATE_INSPECTED_TILE_DESCRIPTION` reducer payload placeholder casts, typed the existing `minimapFocus` state field, and proves typed `MapData.gridSize` minimap centering plus exact inspected-tile description writes.
- T15 routed the schedule/proximity TODO cluster: Travel owns forced march application, Events owns scheduler markers, Memory owns action-to-memory coverage, and Town Description owns proximity-triggered town-description loading.
- T16 made returned daily-world log IDs deterministic for identical saved game time and world seed, including logs returned from sibling daily subsystems through the `WorldEventManager` boundary.

## Relevant Tests

- `src/systems/world/__tests__/WorldEventManager.test.ts`
- `src/systems/world/__tests__/FactionManager.test.ts`
- `src/systems/world/__tests__/FactionEconomyManager.test.ts`
- `src/systems/world/__tests__/NobleIntrigueManager.test.ts`
- `src/state/reducers/__tests__/worldReducer.test.ts`
- `src/services/worldSim/__tests__/*.test.ts`

## Current Gaps To Track

Keep this project focused on world-system ownership; do not close open items from world generation, event simulation, or state typing under town-only docs.

## Resume Notes

1. Read this file.
2. Read `docs/projects/world/TRACKER.md`.
3. Read `docs/projects/world/GAPS.md`.
4. No active World-owned task remains. If new World work is discovered, open a new source-backed gap before implementation.
5. Old tile-grid fields stay until Travel and Submap owner lanes close their side. Do not absorb Travel's cell-native movement work, Submap's UI retirement work, or WorldSim Service performance work into this completed World scope.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- do not continue World work unless a new source-backed World-owned gap is opened
- keep World's scope to the canonical world-geography contract and adapters
- route Travel cell-native movement/pathfinding and Submap UI retirement work to their owner projects
- do not invent gaps just to satisfy a count
