# Quest Log Gap Registry

Status: active (G3 decided 2026-06-10; implementation lane open)
Last updated: 2026-06-10

Use this file for durable gaps the current docs-to-source scan could not close.

Current iteration focus:
- G1 is now closed as a source-backed bridge into journal pending events.
- G3 remains the current in-scope behavior check before code edits resume.
- Update 2026-06-10: G3 is decided (D14, Option A) — wire the quest-giver bridge in `handleNpcInteraction.ts` with focused tests and a minimal quest-offer payload defined as part of the work.
- G4 is now closed by surfacing `fail_with_note` deadline notes in the Quest Log history card.
- G6 is now closed by materializing queued quest events into the next journal entry.
- G7 is now closed by the long-rest journal producer that dispatches `ADD_JOURNAL_ENTRY` in play.
- G2 and G5 remain adjacent follow-up work owned by the broader quests system.

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | done | resolved | Worker | `docs/projects/quest-log/TRACKER.md` | source-backed quest bridge pass | Align quest reducer transitions with journal event logging | `src/state/reducers/questReducer.ts`, `src/systems/quests/QuestManager.ts`, `src/systems/quests/questJournal.ts` | Quest acceptance, completion, and deadline-failure transitions now queue journal events | Keep the queue bridge documented and verify the remaining journal-materialization step | `docs/projects/quest-log/AUDIT_OR_PROOF.md` records the source-backed bridge |
| G2 | adjacent_follow_up | adjacent_follow_up | Worker | `docs/projects/quests/TRACKER.md` | doc update pass | Replace hardcoded item/location quest triggers with data-driven quest hooks | `src/hooks/actions/handleItemInteraction.ts`, `src/hooks/actions/handleMovement.ts` | Hardcoded mappings are brittle and block content expansion | Route this to `docs/projects/quests` as the owning engine-domain gap | `docs/projects/quests/GAPS.md` records migration acceptance criteria |
| G3 | active | blocked_human_decision | human/product owner | `docs/projects/quest-log/TRACKER.md` | source scan / doc update pass | Decide whether `handleNpcInteraction.ts` should own the quest-giver bridge or stay dialogue-only until a broader dialogue/quest contract is named | `src/hooks/actions/handleNpcInteraction.ts`, `src/services/dialogueService.ts`, `src/data/dialogue/topics.ts`, `src/hooks/useDialogueSystem.ts`; `docs/projects/DECISION_BLITZ_2026-06-10.md` D14 | Current quest starts are still mostly item/location-driven, and the dialogue layer has no quest-offer payload or topic contract to wire safely from this handler alone | Decided 2026-06-10 (Remy, D14, Option A): wire the quest-giver bridge now in `handleNpcInteraction.ts`; define a minimal quest-offer payload as part of the work and cover the handoff with focused tests | Focused source-backed test for the wired handoff path plus `node scripts\audit-living-project-docs.cjs --project quest-log` |
| G4 | done | resolved | Worker | `src/systems/quests/QuestManager.ts` / `src/components/QuestLog/QuestHistoryRow.tsx` | doc update pass | Clarify failed-quest user-facing behavior for `log_only` and `fail_with_note` consequences | `QuestManager.ts`, `QuestHistoryRow.tsx`, `QuestLog.test.tsx` | Deadline outcomes now keep `log_only` system-message only and surface `fail_with_note` notes in the quest history view | Keep the history note render aligned with the deadline checker and note trail | `src/systems/quests/__tests__/QuestManager.test.ts`, `src/components/QuestLog/__tests__/QuestLog.test.tsx`, and `AUDIT_OR_PROOF.md` prove the behavior |
| G5 | adjacent_follow_up | adjacent_follow_up | Worker | `src/types/quests.ts` / `docs/projects/quests/NORTH_STAR.md` | doc update pass | Resolve schema mismatch between legacy `Quest` and richer staged `QuestDefinition` in runtime flow | `src/types/quests.ts`, `src/state/reducers/questReducer.ts` | Migration risk for reward/objective behavior and serializer compatibility | Keep migration plan in `docs/projects/quests` and treat this project as owning local impact only | Add project routing comment in `NORTH_STAR.md` |
| G6 | done | resolved | Worker | `src/state/reducers/journalReducer.ts` | source-backed quest bridge pass | Pending quest journal events were queued but not yet materialized into visible journal entries | `src/state/reducers/questReducer.ts`, `src/systems/quests/QuestManager.ts`, `src/systems/quests/questJournal.ts`, `src/state/reducers/journalReducer.ts`, `src/state/reducers/__tests__/journalReducer.test.ts` | Quest history now reaches visible journal pages when a journal entry is added | Keep the flush point aligned with the journal authoring flow | `src/state/reducers/__tests__/journalReducer.test.ts` covers merge and queue drain |
| G7 | done | resolved | Worker | `src/hooks/actions/handleResourceActions.ts` | runtime producer wiring pass | The reducer can materialize queued events, but no runtime caller was found that dispatches `ADD_JOURNAL_ENTRY` | `src/state/actionTypes.ts`, `src/state/reducers/journalReducer.ts`, `src/hooks/actions/handleResourceActions.ts`, `src/hooks/actions/__tests__/handleResourceActions.test.ts`, `src/state/reducers/__tests__/journalReducer.test.ts` | The flush contract now runs in play after long rest | Keep the long-rest journal producer aligned with the reducer flush point | `src/hooks/actions/__tests__/handleResourceActions.test.ts` and `src/state/reducers/__tests__/journalReducer.test.ts` prove the bridge |

## Classification Reference

- `in_scope_now`: must be handled before this slice can be considered complete.
- `support_needed_now`: needed for a stable handoff or next implementation slice.
- `adjacent_follow_up`: related future work that should not block this slice.
- `out_of_scope`: explicitly outside this project.
- `blocked_human_decision`: waiting for product/behavioral decision.
- `blocked_external_state`: blocked by another actor/system.

## Update Rules

- Keep entries tied to concrete files and a next check.
- Route non-local gaps to owning projects with a clear destination instead of expanding this log indefinitely.
