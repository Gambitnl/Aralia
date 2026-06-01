# Quests System Tracker

Status: active
Last updated: 2026-05-31

## Status Vocabulary
- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|---|
| QTS-1 | done | Create project-level living docs from registry and bounded scan evidence | Worker A | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Keep this file, NORTH_STAR.md, and GAPS.md aligned as handoff artifacts | Verify file map and links are resolvable |
| QTS-2 | active | Document concrete implemented state and integration boundaries in living docs | Worker A | 2026-05-31 | `src/systems/quests/QuestManager.ts`, `src/state/reducers/questReducer.ts`, `src/components/QuestLog/` | Complete evidence tables for NORTH_STAR and GAPS | Validate against current scan evidence |
| QTS-3 | not_started | Decide migration path for richer quest schema (`QuestDefinition`) against legacy reducer contract | Worker A | 2026-05-31 | `src/types/quests.ts`, `src/state/reducers/questReducer.ts` | Add migration plan and owner when implementation resumes | Confirm reducer and type contract compatibility checks |
| QTS-4 | not_started | Confirm quest trigger authoring strategy (hardcoded vs metadata-driven) | Worker A | 2026-05-31 | `src/hooks/actions/handleMovement.ts`, `src/hooks/actions/handleItemInteraction.ts` | Add decision log once ownership and acceptance criteria set | Check for data-driven alternatives in nearby systems |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence | Why it matters | Next action | Next proof |
|---|---|---|---|---|---|---|---|---|---|
| QG-1 | in_progress | support_needed_now | Worker A | `docs/projects/quests/GAPS.md` | 2026-05-31 scan | Runtime and types are out of sync (`QuestDefinition` vs legacy `Quest` reducer shape) | `src/types/quests.ts`, `src/state/reducers/questReducer.ts`, `src/types/index.ts` | Preserve progression safety before adding new quest features | Add migration steps and rollback strategy |
| QG-2 | in_progress | support_needed_now | Worker A | `docs/projects/quests/GAPS.md` | 2026-05-31 scan | Quest triggers are hardcoded by ID and not metadata-driven | `src/hooks/actions/handleMovement.ts`, `src/hooks/actions/handleItemInteraction.ts` | Limits authoring, makes hidden coverage brittle | Define trigger schema and event source of truth |
| QG-3 | in_progress | support_needed_now | Worker A | `docs/projects/quests/GAPS.md` | 2026-05-31 scan | Advanced failure conditions and stage-level branching are not fully wired | `src/systems/quests/QuestManager.ts`, `src/types/quests.ts` | Blocks richer quest narratives | Define minimal staged quest model integration |
| QG-4 | not_started | globalize | Worker A | `docs/projects/GLOBAL_GAPS.md` | 2026-05-31 scan | Cross-project schema mismatch patterns may affect types contract tests and tooling | `src/test/contracts/quests.contract.test.ts`, project registry | Similar mismatch risks across unrelated lanes (dialogue, world, save) | Add a scoped GLOBAL_GAPS note if mismatch appears outside quests scope |
