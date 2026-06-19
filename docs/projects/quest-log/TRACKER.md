# Quest Log Living Tracker

Status: active (T7 implemented 2026-06-19; adjacent quest-system follow-ups remain)
Last updated: 2026-06-19

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
| T7 | done | Verify NPC quest handoff path in `handleNpcInteraction.ts` | Codex | 2026-06-19 | `src/hooks/actions/handleNpcInteraction.ts`, `src/hooks/actions/__tests__/handleNpcInteraction.test.ts`, `src/types/actions.ts`, `docs/projects/quest-log/AUDIT_OR_PROOF.md` | Implemented Option A: `talk` actions can carry a minimal `questOffer: { questId }`, and `handleNpcInteraction.ts` resolves that id through `INITIAL_QUESTS` before dispatching the existing `ACCEPT_QUEST` action | `npm test -- src/hooks/actions/__tests__/handleNpcInteraction.test.ts`; `node scripts\audit-living-project-docs.cjs --project quest-log` |

## Project Health Notes

- This tracker now reflects the source-backed quest/journal/deadline bridge, the journal reducer flush point for queued events, and the long-rest runtime producer that opens a new journal page in play.
- It also records the deadline note surface in the Quest Log history card and the NPC quest handoff review gate now blocking forward implementation.
- Update 2026-06-10: the NPC quest handoff review gate is cleared â€” the owner chose Option A (D14, `docs/projects/DECISION_BLITZ_2026-06-10.md`), so T7 is the open implementation lane.
- Update 2026-06-19: T7 is implemented. The bridge keeps the offer payload minimal (`questId` only), resolves the full quest from the existing quest registry, and preserves no-offer NPC dialogue behavior.
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
