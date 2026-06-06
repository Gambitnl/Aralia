# Quest Log Gaps

Status: active
Last updated: 2026-06-05

Use this file for durable gaps the current docs-to-source scan could not close.

Current iteration focus:
- G1 is the active support-needed-now gap for the next implementation slice.
- G3 and G4 are the current in-scope behavior checks before code edits resume.
- G2 and G5 remain adjacent follow-up work owned by the broader quests system.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | support_needed_now | support_needed_now | Worker | `docs/projects/quest-log/TRACKER.md` | doc update pass | Align quest reducer transitions with journal event logging | `src/state/reducers/questReducer.ts`, `src/state/reducers/journalReducer.ts`, `src/types/journal.ts` | Journal and quest history are currently partially parallel and not fully coupled | Capture one acceptance/completion event contract before next implementation cycle | Record the contract in `AUDIT_OR_PROOF.md` and update tracker after source-backed evidence |
| G2 | adjacent_follow_up | adjacent_follow_up | Worker | `docs/projects/quests/TRACKER.md` | doc update pass | Replace hardcoded item/location quest triggers with data-driven quest hooks | `src/hooks/actions/handleItemInteraction.ts`, `src/hooks/actions/handleMovement.ts` | Hardcoded mappings are brittle and block content expansion | Route this to `docs/projects/quests` as the owning engine-domain gap | `docs/projects/quests/GAPS.md` records migration acceptance criteria |
| G3 | in_scope_now | in_scope_now | Worker | `docs/projects/quest-log/NORTH_STAR.md` | doc update pass | Verify NPC quest handoff path in `handleNpcInteraction.ts` is still TODO for quest give/accept flow | `src/hooks/actions/handleNpcInteraction.ts` | Current quest starts are mostly item/location-driven; handoff behavior is incomplete | Add acceptance test for dialogue quest start if this project moves into implementation scope | Update tracker row after test proof and note the result in `AUDIT_OR_PROOF.md` |
| G4 | in_scope_now | in_scope_now | Worker | `src/systems/quests/QuestManager.ts` / `src/systems/world/WorldEventManager.ts` | doc update pass | Clarify failed-quest user-facing behavior for `log_only` and `fail_with_note` consequences | `QuestManager.ts`, `JournalSpread.tsx`, `JournalTab` integration points | Deadline outcomes exist but UX consistency not fully confirmed | Add check for log content + visible message behavior on deadline fail | Log results in `AUDIT_OR_PROOF.md` and tracker if behavior differs |
| G5 | adjacent_follow_up | adjacent_follow_up | Worker | `src/types/quests.ts` / `docs/projects/quests/NORTH_STAR.md` | doc update pass | Resolve schema mismatch between legacy `Quest` and richer staged `QuestDefinition` in runtime flow | `src/types/quests.ts`, `src/state/reducers/questReducer.ts` | Migration risk for reward/objective behavior and serializer compatibility | Keep migration plan in `docs/projects/quests` and treat this project as owning local impact only | Add project routing comment in `NORTH_STAR.md` |

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
