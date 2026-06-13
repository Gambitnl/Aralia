# Quests System Living Tracker

Status: active
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

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|---|
| QTS-4 | not_started | Confirm quest trigger authoring strategy (hardcoded vs metadata-driven) | Worker A | 2026-05-31 | `src/hooks/actions/handleMovement.ts`, `src/hooks/actions/handleItemInteraction.ts` | Add decision log once ownership and acceptance criteria set | Check for data-driven alternatives in nearby systems |
| QTS-5 | not_started | Implement Phase 1 adapter â€” `adaptQuestDefinitionToQuest` with round-trip unit test | unassigned | 2026-06-10 | `docs/projects/quests/DECISIONS.md` D2, `src/types/quests.ts` | Create `src/systems/quests/questAdapter.ts` and `src/systems/quests/__tests__/questAdapter.test.ts` | Adapter round-trip test passes; legacy reducer still works with adapted quests |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence | Why it matters | Next action | Next proof |
|---|---|---|---|---|---|---|---|---|---|---|
| QG-2 | in_progress | support_needed_now | Worker A | `docs/projects/quests/GAPS.md` GQ-2 | 2026-05-31 scan | Quest triggers are hardcoded by ID and not metadata-driven | `src/hooks/actions/handleMovement.ts`, `src/hooks/actions/handleItemInteraction.ts` | Limits authoring, makes hidden coverage brittle | Define trigger schema and event source of truth | Verify one trigger declaration can add at least one new quest without code changes |
| QG-3 | in_progress | support_needed_now | Worker A | `docs/projects/quests/GAPS.md` GQ-3 | 2026-05-31 scan | Advanced failure conditions and stage-level branching are not fully wired | `src/systems/quests/QuestManager.ts`, `src/types/quests.ts` | Blocks richer quest narratives | Define minimal staged quest model integration | Add tests for each consequence and branch behavior |
| QG-4 | not_started | globalize | Worker A | `docs/projects/GLOBAL_GAPS.md` | 2026-05-31 scan | Cross-project schema mismatch patterns may affect types contract tests and tooling | `src/test/contracts/quests.contract.test.ts`, project registry | Similar mismatch risks across unrelated lanes (dialogue, world, save) | Add a scoped GLOBAL_GAPS note if mismatch appears outside quests scope | Cross-check with adjacent schema owners (dialogue/world) |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
