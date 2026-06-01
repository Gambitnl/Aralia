# World System Living Tracker

Status: active  
Last updated: 2026-05-31

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Replace placeholder world docs with concrete cold-start context and file map. | Codex integration pass | 2026-05-31 | `src/systems/world`, `src/state`, `src/services/worldSim`, `src/types`, `src/hooks/actions`, `src/systems/world/__tests__` | Maintain scope to world ownership and keep town work in town-description project. | `docs/projects/world/NORTH_STAR.md` is evidence-backed. |
| T2 | active | Complete world-system gap pass from observed simulation/state contracts. | future agent | 2026-05-31 | `src/systems/world/WorldEventManager.ts`, `src/state/migrations/worldDataMigration.ts`, `src/types/world.ts`, `src/types/state.ts` | Add/triage gaps in `docs/projects/world/GAPS.md` and mark dependencies before any code change proposal. | Each open gap has a next proof/check row. |
| T3 | adjacent_follow_up | Keep world-system registry separation from town-description scope. | future agent | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`, `docs/projects/town-description-system` | Verify handoff boundary in the next world pass and any new project-local docs. | Confirm no gap in this project owns only town-content behavior. |

## Task Slice Notes

- Active slice completion target: this project owns broad world-state contracts and simulation behavior, not runtime implementation.
- Allowed files for docs-only pass: only `docs/projects/world/NORTH_STAR.md`, `docs/projects/world/TRACKER.md`, `docs/projects/world/GAPS.md`.
- Evidence for next review pass: world event pipeline, migration path, and integration with `ADVANCE_TIME`, `START_NEW_GAME_SETUP`, `START_GAME_FOR_DUMMY`, and `LOAD_GAME_SUCCESS`.

## Next Checks

- Confirm `worldDataMigration` is still invoked from load/setup flows for legacy save compatibility.
- Confirm world event/event rumor handling has deterministic and typed boundaries for `weather` and `economy.activeEvents`.
- Confirm whether world geography outputs (`WorldData`) are consumed by 3D/world-render consumers or remain save-data only.
