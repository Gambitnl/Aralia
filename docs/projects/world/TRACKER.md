# World Living Tracker

Status: active (G3 decision recorded 2026-06-10; implementation lane open)
Last updated: 2026-06-10

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`
## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Replace placeholder world docs with concrete cold-start context and file map. | Codex integration pass | 2026-05-31 | `src/systems/world`, `src/state`, `src/services/worldSim`, `src/types`, `src/hooks/actions`, `src/systems/world/__tests__` | Maintain scope to world ownership and keep town work in town-description project. | `docs/projects/world/NORTH_STAR.md` is evidence-backed. |
| T2 | active | Complete world-system gap pass from observed simulation/state contracts. | future agent | 2026-06-10 | `src/systems/world/WorldEventManager.ts`, `src/state/migrations/worldDataMigration.ts`, `src/types/world.ts`, `src/types/state.ts`, `src/components/MapPane.tsx`, `src/hooks/actions/handleMovement.ts`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D2 | G3 decided 2026-06-10 (Option B): preserve tile-grid contracts via explicit adapters to a new canonical world-geography contract; start with the contract preservation table. | Contract preservation table before forward runtime edits. |
| T4 | not_started | Extract tile-grid world-map dependency contract for phase-out planning. | future agent | 2026-06-10 | `src/components/MapPane.tsx`, `src/hooks/actions/handleMovement.ts`, `src/types/world.ts`, `src/state/appState.ts`, `src/state/migrations/worldDataMigration.ts`, `src/hooks/useGameInitialization.ts`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D2 | Document movement semantics, discovery/current markers, passability, startup/load continuity, and 3D marker anchors — now as the adapter inventory for the decided new canonical world-geography contract (G3 Option B, 2026-06-10). | Project docs name preserved contracts, per-dependency adapters, and owner routing. |
| T3 | adjacent_follow_up | Keep world-system registry separation from town-description scope. | future agent | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`, `docs/projects/town-description-system` | Verify handoff boundary in the next world pass and any new project-local docs. | Confirm no gap in this project owns only town-content behavior. |

## Task Slice Notes

- Active slice completion target: this project owns broad world-state contracts and simulation behavior, not runtime implementation.
- Allowed files for docs-only pass: only `docs/projects/world/NORTH_STAR.md`, `docs/projects/world/TRACKER.md`, `docs/projects/world/GAPS.md`.
- Evidence for next review pass: world event pipeline, migration path, and integration with `ADVANCE_TIME`, `START_NEW_GAME_SETUP`, `START_GAME_FOR_DUMMY`, and `LOAD_GAME_SUCCESS`.

## Next Checks

- Confirm `worldDataMigration` is still invoked from load/setup flows for legacy save compatibility.
- Confirm world event/event rumor handling has deterministic and typed boundaries for `weather` and `economy.activeEvents`.
- Confirm whether world geography outputs (`WorldData`) are consumed by 3D/world-render consumers or remain save-data only.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | future agent | docs/projects/PROJECT_CARD_SCHEMA.md | schema normalization | Replace this seeded gap row with project-specific findings if any remain after the next bounded gap sweep | docs/agent-workflows/living-project-task-protocol/templates/GAPS.md | The workflow requires durable gaps to have a consistent table shape and evidence path | Perform a bounded gap sweep and either update this row or close it as no longer applicable | Updated GAPS.md and TRACKER.md agree on the project gap state |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
