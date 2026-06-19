---
schema_version: 1
gap_schema: project_gap_registry
project: World
slug: world
status: "complete for World-owned scope (all gaps resolved or routed)"
status_note: ""
registry_mode: canonical
last_updated: "2026-06-18"
gap_count: 11
routed_gap_count: 3
open_gap_count: 0
resolved_gap_count: 8
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: high
proof_freshness: mixed
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/world/NORTH_STAR.md
tracker: docs/projects/world/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
allowed_statuses:
  - open
  - active
  - pending
  - blocked
  - not_started
  - in_progress
  - waiting
  - needs_validation
  - untriaged
  - routed
  - review-required
  - design_decision_deferred
  - merged-reference
  - resolved
  - closed
  - done
  - complete
  - out_of_scope
allowed_classifications:
  - in_scope_now
  - support_needed_now
  - adjacent_follow_up
  - out_of_scope
  - blocked_human_decision
  - blocked_external_state
  - uncertainty
  - architecture
  - workflow
  - execution-path
  - typing-safety
  - mechanics
  - ui
  - integration
  - data-model
  - test_coverage
  - schema_normalization
  - ownership
  - serialization
  - coverage
  - globalize
  - routed
  - design_decision_deferred
allowed_severities:
  - none
  - low
  - medium
  - high
  - critical
supported_optional_row_fields:
  - owner_confidence
  - source_project
  - imported_from
  - global_gap_id
  - linked_gap_id
  - routed_to
  - decision_required
  - decision_reference
  - review_required
  - visual_proof_required
  - proof_freshness
  - proof_date
  - uncertainty
  - notes
supported_optional_sections:
  - Current Readout
  - Current State
  - Purpose
  - Summary
  - Iteration Notes
  - Classification Notes
  - Global Routing
  - Global Gap Imports
  - Resolved Gap Log
  - Required Review Brief
  - Decision Visualizations
  - Open / Uncertain Notes
  - Appendix
---
# World Gap Registry

Status: complete for World-owned scope (all gaps resolved or routed)
Last updated: 2026-06-18

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | world project | `docs/projects/world/TRACKER.md` | state/scanner pass | World event manager was believed to read weather through `as any`; current code now reads the typed environment bridge. | `src/systems/world/WorldEventManager.ts` uses `state.environment ?? DEFAULT_WEATHER` in skirmish and market weighting; `rg -n 'as any\|state\.weather\|\(state as' src\systems\world\WorldEventManager.ts` found no weather cast on 2026-06-18. | This previously risked drift between world events and the Environment system. | Closed for this gap; keep future weather changes routed through the Environment contract. | `npx vitest run src/systems/world/__tests__/WorldEventManager.test.ts src/state/reducers/__tests__/worldReducer.test.ts` passed 13 tests on 2026-06-18. |
| G2 | done | in_scope_now | world project | `src/systems/world/WorldEventManager.ts` | source scan | Economy active event cleanup was believed to cast `activeEvents` via `as any`; current code reads `state.economy.activeEvents` through the typed economy shape. | `src/systems/world/WorldEventManager.ts` active-event cleanup and market-factor paths; focused grep found no active-event `as any` cast on 2026-06-18. | This previously risked silent drift in market-event duration and schema handling. | Closed for this gap; reopen only if a future economy schema change reintroduces untyped active-event handling. | `npx vitest run src/systems/world/__tests__/WorldEventManager.test.ts src/state/reducers/__tests__/worldReducer.test.ts` passed 13 tests on 2026-06-18. |
| G3 | done | in_scope_now | world project (decision: Remy 2026-06-10) | `docs/projects/world/TRACKER.md` | integration review | Tile-grid `MapData` remains the gameplay compatibility layer while Azgaar/3D paths replace the old world-map renderer. Decided 2026-06-10 (DECISION_BLITZ D2): promote a new canonical world-geography contract aligned with the Azgaar-based pipeline, and build explicit adapters for every tile-grid dependency (movement, passability, discovery, save/load/migration, 3D markers) before retiring old fields. | `src/components/MapPane.tsx`, `src/hooks/actions/handleMovement.ts`, `src/types/world.ts`, `src/state/appState.ts`, `src/state/migrations/worldDataMigration.ts`, `src/state/migrations/__tests__/worldDataMigration.test.ts`, `src/hooks/useGameInitialization.ts`, `src/utils/world/worldGeographyAdapter.ts`, `src/utils/world/__tests__/worldGeographyAdapter.test.ts`, `src/state/__tests__/appState.worldGeographySnapshot.test.ts`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D2, `docs/projects/world/WORLD_GEOGRAPHY_ADAPTER_CONTRACT.md` | Movement semantics, passability, startup/load compatibility, migration, and 3D marker anchors can break if tile-grid world-map paths are phased out without explicit adapters. The World-owned adapter lane now has source proof for read projection, discovery/current mutation, movement marker writes, MapPane marker reads, startup/load continuity, passability, migration persistence, and 3D anchor conversion. | Closed for the World-owned adapter lane; do not retire legacy fields until G11/GG-29 plus Travel/Submap owner lanes close their side. | `npx vitest run src/utils/world/__tests__/worldGeographyAdapter.test.ts src/components/__tests__/MapPane.test.tsx src/utils/__tests__/worldCoords.test.ts src/state/migrations/__tests__/worldDataMigration.test.ts` passed 4 files / 32 tests on 2026-06-18. |
| G4 | done | in_scope_now | world project | `src/types/state.ts` / `src/state/appState.ts` | state/type scan | Optional world fields (`activeRumors`, `worldHistory`, `notifications`/`merchant` metadata) plus TODO debt were partially enforced. | `src/types/state.ts`, `src/types/state.d.ts`, `src/state/initialState.ts`, `src/state/appState.ts`, `src/utils/core/factories.ts`, `src/state/__tests__/appState.worldStateShape.test.ts` | Optional/loose fields reduce runtime guarantees and can hide missing initialization expectations. T13 made `activeRumors` and `worldHistory` mandatory, seeded fresh/factory defaults, and repaired legacy loads for rumor/history/notification/merchant UI fields. | Closed for the mandatory world-state shape slice; reopen only if a future save/load path bypasses `LOAD_GAME_SUCCESS` normalization. | `npx vitest run src/state/__tests__/appState.worldStateShape.test.ts src/state/__tests__/appState.worldHistory.test.ts src/state/reducers/__tests__/worldReducer.test.ts src/systems/world/__tests__/WorldEventManager.test.ts` passed 4 files / 17 tests on 2026-06-18. |
| G5 | done | support_needed_now | world project | `src/state/reducers/worldReducer.ts` | source scan | Reducer contained placeholder casts and stale TODO debt for map payload and inspected tile payload. | `src/state/reducers/worldReducer.ts`, `src/state/actionTypes.ts`, `src/types/state.ts`, `src/state/reducers/__tests__/worldReducer.test.ts` | Reducer drift added coupling risk in map initialization and action payload handling. T14 replaced the local casts with typed action-payload aliases, typed the existing `minimapFocus` state field, centered minimap focus from `MapData.gridSize`, and preserved inspected-tile description writes by exact tile key. | Closed for the narrow reducer payload contract slice; reopen only if new reducer payload casts are introduced for these actions. | `npx vitest run src/state/reducers/__tests__/worldReducer.test.ts` passed 10 tests on 2026-06-18; dependency headers synced for `src/state/reducers/worldReducer.ts` and `src/types/state.ts`; broad `npm run typecheck` still fails on pre-existing repo-wide TypeScript debt outside this slice. |
| G6 | routed | routed | Travel / Events / Memory / Town Description owners | `docs/projects/travel/GAPS.md` G1; `docs/projects/events/GAPS.md` G3-G4; `docs/projects/memory/GAPS.md` G4; `docs/projects/town-description-system/GAPS.md` G5 | T15 boundary audit 2026-06-18 | Long-rest/rapid movement world coupling is split across `handleWorldEvents.ts` and `handleMovement.ts`, with TODOs for schedule hooks and settlement proximity hooks. | `src/hooks/actions/handleMovement.ts` forced-march/proximity TODOs; `src/hooks/actions/handleWorldEvents.ts` NPC daily routine/faction schedule TODO and `handleLongRestWorldEvents`; owner docs listed in owning tracker/subsystem column. | The audit found no small World-owned runtime fix that would not absorb sibling lanes: long rest already runs residue checks, memory decay, and gossip; forced march belongs to Travel; event scheduler markers belong to Events; action-to-memory mapping belongs to Memory; proximity-driven town-description loading belongs to Town Description. | Closed as routed for World. Do not implement these sibling behaviors in World unless an owner project explicitly hands back a World contract slice. | T15 proof is docs/source-backed: owner gap rows exist for Travel forced march, Events scheduler envelope, Memory action-to-memory mapping, and Town proximity loading; no World code changed. |
| G7 | done | adjacent_follow_up | world project | `src/systems/world/WorldEventManager.ts` | test coverage scan | Daily event loop used random generation with `Date.now()` for ID generation and non-deterministic daily log IDs. | `src/systems/world/WorldEventManager.ts`; `src/systems/world/__tests__/WorldEventManager.test.ts` | Hard-to-replay logs and event IDs can hinder deterministic simulation regression checks. T16 keeps event choice seeded and normalizes the returned daily log envelope so sibling subsystem wall-clock IDs do not leak into World replay results. | Closed for deterministic daily-world log IDs; route any deeper economy, quest, intrigue, or crime ID policy cleanup to those owner systems unless World needs another boundary normalizer. | Red proof: focused WorldEventManager test failed when `Date.now()` changed between identical seeded runs; green proof: `npx vitest run src/systems/world/__tests__/WorldEventManager.test.ts` passed 6 tests on 2026-06-18; dependency header synced for `src/systems/world/WorldEventManager.ts`. |
| G8 | routed | routed | WorldSim Service owner | `docs/projects/worldsim-service/GAPS.md` WSS-001 | architecture scan; T17 owner audit 2026-06-18 | worldSim pipeline is synchronous and `worldDataMigration` documents potential load-time cost; no worker or deferred pipeline documented in the World project. | `src/services/worldSim/index.ts`, `src/state/migrations/worldDataMigration.ts`, `docs/projects/worldsim-service/GAPS.md` WSS-001 | Large map generation or legacy-save migration may block; however the generation pipeline owner is WorldSim Service, which already tracks synchronous `runWorldSim(...)` blocking risk, measurement, and background scheduling decisions. | Closed as routed for World. Do not implement worker/deferred worldSim architecture in World unless WorldSim Service hands back a specific World integration contract. | T17 source/doc proof: WorldSim Service WSS-001 already owns "Synchronous world simulation can block UI for large maps" with next action to measure generation and migration time and decide if background scheduling is required. |
| G9 | done | support_needed_now | world project | `src/services/worldSim/types.ts` / `src/types/world.ts` | T2 contract pass 2026-06-18 | `WorldData` is canonical for worldSim/3D, but its current schema is still rectangular-grid shaped (`gridSize`, per-cell arrays) and is stored inside the broader `MapData` envelope. | `src/services/worldSim/types.ts` defines `WorldData.gridSize`, `heights`, `temperatures`, `moisture`, `biomeIds`; `src/types/world.ts` keeps `MapData.tiles` and optional `worldData`; `docs/projects/world/WORLD_GEOGRAPHY_ADAPTER_CONTRACT.md` defines the target adapter shape; `src/utils/world/worldGeographyAdapter.ts` implements the read-only source contract. | D2 required source-level target types before runtime rewiring. T5 added `WorldGeographyId`, `WorldGeographyPoint`, `WorldGeographySnapshot`, `WorldGeographyAdapter`, read-only `fromMapData`, stable legacy IDs, passability projection, and `WorldData` carry-through. | Closed for the read-only source adapter slice; broader runtime adapter work continues under G3/G10. | `npx vitest run src/utils/world/__tests__/worldGeographyAdapter.test.ts` passed 4 tests on 2026-06-18. |
| G10 | done | support_needed_now | world project | `src/hooks/actions/handleMovement.ts` / `src/components/MapPane.tsx` | T2 contract pass 2026-06-18 | Discovery and current-position markers still live on `MapTile.discovered` / `MapTile.isPlayerCurrent`, but the World-owned compatibility adapter now owns the read/write bridge for those flags. | `src/hooks/actions/handleMovement.ts` uses `buildLegacyDiscoveryMutations`, `createSetCurrentMutation`, and `applyMutationsToMapData`; `src/components/MapPane.tsx` projects marker reads through `fromMapData` and `resolveLegacyTile`; `src/utils/world/worldGeographyAdapter.ts` provides the source contract; `src/components/__tests__/MapPane.test.tsx` and movement tests prove behavior. | D2 required adapters for discovery/current markers before tile-grid fields can retire. T6/T7/T8 provide the World-owned compatibility adapter and proof; future cell-native replacement remains routed through G3/G11 plus Travel/Submap owner lanes. | Closed for the World discovery/current marker adapter lane; do not remove legacy fields until G3/G11 stop conditions and sibling owner work are satisfied. | `npx vitest run src/components/__tests__/MapPane.test.tsx src/utils/world/__tests__/worldGeographyAdapter.test.ts src/hooks/actions/__tests__/handleMovement.test.ts src/hooks/actions/__tests__/handleMovement_skillCheck.test.ts` passed 4 files / 14 tests on 2026-06-18. |
| G11 | routed | routed | Travel / Submap / Global owners | `docs/projects/GLOBAL_GAPS.md` GG-29; `docs/projects/travel/GAPS.md` G6-G10; `docs/projects/submap/GAPS.md` G9-G12 | bounded gap sweep 2026-06-18; T18 owner seam audit 2026-06-18 | Global gap GG-29 names final `MapData.tiles` retirement after cell-native travel/geography are stable; World owns the canonical geography-contract portion, while Submap owns surface retirement and Travel owns movement/pathfinding. | `docs/projects/GLOBAL_GAPS.md` GG-29; `docs/projects/submap/NORTH_STAR.md`; `docs/projects/submap/GAPS.md` G9-G12; `docs/projects/travel/GAPS.md` G6-G10. | Without an explicit seam, agents can duplicate or misroute final grid retirement work across World, Submap, and Travel. T18 updated GG-29 with the accepted owner split. | Closed as routed for World. Travel owns cell-native movement/discovery/marker updates; Submap owns grid/Submap retirement and Enter-3D grid-coordinate decoupling; Global GG-29 remains the umbrella until those owner lanes close. | World G3/G9/G10 are already resolved with adapter-contract proof; GG-29 now links Travel G6-G10, Submap G9-G12, and World G11. No World runtime code changed for T18. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
