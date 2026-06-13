# Quest Log Living Tracker

Status: active (G3 decided 2026-06-10; implementation lane open)
Last updated: 2026-06-12

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
| T7 | active | Verify NPC quest handoff path in `handleNpcInteraction.ts` | human/product owner | 2026-06-10 | `src/hooks/actions/handleNpcInteraction.ts`, `src/services/dialogueService.ts`, `src/data/dialogue/topics.ts`, `docs/projects/quest-log/GAPS.md`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D14 | Decided 2026-06-10 (Remy, D14, Option A): wire the quest-giver bridge in `handleNpcInteraction.ts`, defining a minimal quest-offer payload as part of the work | Focused source-backed test for the wired handoff path stays green; `node scripts\audit-living-project-docs.cjs --project quest-log` |

## Project Health Notes

- This tracker now reflects the source-backed quest/journal/deadline bridge, the journal reducer flush point for queued events, and the long-rest runtime producer that opens a new journal page in play.
- It also records the deadline note surface in the Quest Log history card and the NPC quest handoff review gate now blocking forward implementation.
- Update 2026-06-10: the NPC quest handoff review gate is cleared â€” the owner chose Option A (D14, `docs/projects/DECISION_BLITZ_2026-06-10.md`), so T7 is the open implementation lane.
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
