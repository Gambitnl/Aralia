# Quest Log Living Tracker

Status: active (G3 decided 2026-06-10; implementation lane open)
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
|---|---|---|---|---|---|---|
| T1 | done | Convert existing source scan into a living-project implementation snapshot in quest-log docs | Worker | 2026-05-31 | `src/components/QuestLog/*`, `src/hooks/actions/*`, `src/state/reducers/*`, `src/systems/quests/QuestManager.ts`, `src/state/appState.ts` | Keep project docs in sync with current implementation + gaps | `Get-Content docs/projects/quest-log/NORTH_STAR.md` shows updated scope and map |
| T2 | done | Confirm Quest Log integration boundaries and next implementation checks before code edits | Worker | 2026-06-09 | `src/state/reducers/questReducer.ts`, `src/systems/quests/QuestManager.ts`, `src/systems/quests/questJournal.ts`, `src/state/reducers/__tests__/questReducer.test.ts`, `src/systems/quests/__tests__/QuestManager.test.ts` | Keep project docs aligned with the verified quest/journal/deadline bridge | `docs/projects/quest-log/AUDIT_OR_PROOF.md` records the source-backed result |
| T3 | done | Route newly discovered task-specific gaps into owning project or global gaps if out-of-scope | Worker | 2026-06-09 | `docs/projects/quest-log/GAPS.md` | Keep newly discovered quest-log gaps classified in the owning project file | `docs/projects/quest-log/GAPS.md` includes the queued-journal follow-up |
| T4 | done | Materialize queued quest journal events into visible journal entries | Worker | 2026-06-09 | `src/state/reducers/journalReducer.ts`, `src/state/reducers/__tests__/journalReducer.test.ts`, `src/components/CharacterSheet/Journal/JournalTab.tsx` | Keep the journal reducer as the flush point for pending quest events | `src/state/reducers/__tests__/journalReducer.test.ts` covers merge + queue drain |
| T5 | done | Identify or wire the runtime flow that should dispatch `ADD_JOURNAL_ENTRY` | Worker | 2026-06-09 | `src/state/actionTypes.ts`, `src/state/reducers/journalReducer.ts`, `src/hooks/actions/handleResourceActions.ts`, `src/hooks/actions/__tests__/handleResourceActions.test.ts`, `src/state/reducers/__tests__/journalReducer.test.ts` | Keep the long-rest journal producer aligned with the reducer flush contract | `npm test -- src/state/reducers/__tests__/questReducer.test.ts src/systems/quests/__tests__/QuestManager.test.ts src/state/reducers/__tests__/journalReducer.test.ts src/hooks/actions/__tests__/handleResourceActions.test.ts` stays green |
| T6 | done | Surface deadline failure notes in the Quest Log history view | Worker | 2026-06-09 | `src/systems/quests/QuestManager.ts`, `src/components/QuestLog/QuestHistoryRow.tsx`, `src/systems/quests/__tests__/QuestManager.test.ts`, `src/components/QuestLog/__tests__/QuestLog.test.tsx` | Keep `fail_with_note` visible without changing the deadline bridge or log-only semantics | `npm test -- src/systems/quests/__tests__/QuestManager.test.ts src/components/QuestLog/__tests__/QuestLog.test.tsx` stays green |
| T7 | active | Verify NPC quest handoff path in `handleNpcInteraction.ts` | human/product owner | 2026-06-10 | `src/hooks/actions/handleNpcInteraction.ts`, `src/services/dialogueService.ts`, `src/data/dialogue/topics.ts`, `docs/projects/quest-log/GAPS.md`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D14 | Decided 2026-06-10 (Remy, D14, Option A): wire the quest-giver bridge in `handleNpcInteraction.ts`, defining a minimal quest-offer payload as part of the work | Focused source-backed test for the wired handoff path stays green; `node scripts\audit-living-project-docs.cjs --project quest-log` |

## Project Health Notes

- This tracker now reflects the source-backed quest/journal/deadline bridge, the journal reducer flush point for queued events, and the long-rest runtime producer that opens a new journal page in play.
- It also records the deadline note surface in the Quest Log history card and the NPC quest handoff review gate now blocking forward implementation.
- Update 2026-06-10: the NPC quest handoff review gate is cleared — the owner chose Option A (D14, `docs/projects/DECISION_BLITZ_2026-06-10.md`), so T7 is the open implementation lane.
- Changes were limited to `docs/projects/quest-log/` and the quest/journal/source/action files named by this task.
- `docs/projects/quests` remains the owner for quest-engine design decisions.
- Durable proof notes now live in `AUDIT_OR_PROOF.md` for the next cold-start agent.

## Update Rules

- Keep task rows with explicit status transitions.
- Keep "next check/proof" concrete and file-based.
- Move blockers to `blocked` only when one concrete dependency prevents progress.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | future agent | docs/projects/PROJECT_CARD_SCHEMA.md | schema normalization | Replace this seeded gap row with project-specific findings if any remain after the next bounded gap sweep | docs/agent-workflows/living-project-task-protocol/templates/GAPS.md | The workflow requires durable gaps to have a consistent table shape and evidence path | Perform a bounded gap sweep and either update this row or close it as no longer applicable | Updated GAPS.md and TRACKER.md agree on the project gap state |
