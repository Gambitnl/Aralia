# World Gap Registry

Status: active (G3 decision recorded 2026-06-10; implementation lane open)
Last updated: 2026-06-10

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | in_scope_now | world project | `docs/projects/world/TRACKER.md` | state/scanner pass | World event manager reads `state.weather` through `as any` and lacks typed weather state coupling. | `src/systems/world/WorldEventManager.ts` lines around skirmish/market logic | Unclear weather contract means event behavior can drift from environment system without compile-time guard. | Decide if `GameState` should include strict weather contract under `environment` and update simulation code once. | Re-run grep for `as any` in `WorldEventManager.ts` and remove in favor of typed accessor. |
| G2 | not_started | in_scope_now | world project | `src/systems/world/WorldEventManager.ts` | source scan | Economy active event cleanup in world loop casts `activeEvents` via `as any` and mutates duration inline. | `src/systems/world/WorldEventManager.ts` around `processWorldEvents` cleanup | Data-shape drift risk in event timing and schema can cause silent logic drift after economy schema changes. | Define/align `MarketEvent` union shape in shared type and replace loose cast with typed narrowing. | Add a type check in unit test around expired active event lifecycle. |
| G3 | not_started | in_scope_now | world project (decision: Remy 2026-06-10) | `docs/projects/world/TRACKER.md` | integration review | Tile-grid `MapData` remains the gameplay compatibility layer while Azgaar/3D paths replace the old world-map renderer. Decided 2026-06-10 (DECISION_BLITZ D2): promote a new canonical world-geography contract aligned with the Azgaar-based pipeline, and build explicit adapters for every tile-grid dependency (movement, passability, discovery, save/load/migration, 3D markers) before retiring old fields. | `src/components/MapPane.tsx`, `src/hooks/actions/handleMovement.ts`, `src/types/world.ts`, `src/state/appState.ts`, `src/state/migrations/worldDataMigration.ts`, `src/hooks/useGameInitialization.ts`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D2 | Movement semantics, passability, discovery/current tile markers, save/load compatibility, and 3D marker anchors can break if tile-grid world-map paths are phased out without an explicit contract. | Implementation lane open: write the contract preservation table, define the new canonical world-geography contract, and build the per-dependency adapters; do not retire tile-grid fields before each adapter is verified. | Contract preservation table plus focused startup/load/movement verification (passability, current/discovered markers, migration, 3D marker anchors). |
| G4 | not_started | in_scope_now | world project | `src/types/world.ts` / `src/types/state.ts` | state/type scan | Optional world fields (`activeRumors`, `worldHistory`, `notifications`/`merchant` metadata) plus TODO debt remain partially enforced. | `src/types/world.ts`, `src/types/state.ts`, `src/state/initialState.ts` | Optional/loose fields reduce runtime guarantees and can hide missing initialization expectations. | Normalize mandatory world state shape in one pass and record migration expectations per field. | Add missing-state assertions in reducer/test setup where required. |
| G5 | not_started | support_needed_now | world project | `src/state/reducers/worldReducer.ts` | source scan | Reducer contains placeholder casts (`as any`/unused imports/TODO debt) for map payload and inspected tile payload. | `src/state/reducers/worldReducer.ts` | Reducer drift adds coupling risk in map initialization and action payload handling. | Decide if this is a local typing cleanup scope or a broader contract gap for action-types doc. | Rework TODOs if this project keeps worldstate touchpoints in active implementation slices. |
| G6 | not_started | adjacent_follow_up | world project | `docs/projects/world/NORTH_STAR.md` | hook scan | Long-rest/rapid movement world coupling is split across `handleWorldEvents.ts` and `handleMovement.ts`, with TODOs for schedule hooks. | `src/hooks/actions/handleMovement.ts`, `src/hooks/actions/handleWorldEvents.ts` | Behavior around NPC schedules and proximity triggers may remain feature incomplete but outside immediate worldsim contract. | Track as adjacency unless active slice expands into simulation/AI behavior. | Reclassify if implementation expands beyond current task boundary. |
| G7 | not_started | adjacent_follow_up | world project | `src/systems/world/WorldEventManager.ts` | test coverage scan | Daily event loop uses random generation with `Date.now()` for ID generation and non-deterministic rumor/game log IDs. | `src/systems/world/WorldEventManager.ts` | Hard-to-replay logs and event IDs can hinder deterministic simulation regression checks. | Decide if deterministic log IDs are required for simulation correctness testing. | Add scoped test for deterministic seed-output behavior if required. |
| G8 | not_started | adjacent_follow_up | world project | `src/services/worldSim/index.ts` + `src/state/migrations/worldDataMigration.ts` | architecture scan | worldSim pipeline is synchronous and `worldDataMigration` documents potential load-time cost; no worker or deferred pipeline documented. | `src/services/worldSim/index.ts`, `src/state/migrations/worldDataMigration.ts` | Large map loads may block; performance risk may affect save-load UX. | Mark as performance follow-up only until active task expands. | Capture benchmark on large map seed sizes if user reports issue. |

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
