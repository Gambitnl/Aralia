# Puzzles System Runbook

Status: active
Last updated: 2026-06-27

## Purpose

Deliver the next bounded puzzle-system iteration against active `TRACKER.md` tasks
while preserving intent and avoiding cleanup-only scope expansion.

## Before You Edit

Read the following first:

- `docs/projects/puzzles/NORTH_STAR.md`
- `docs/projects/puzzles/TRACKER.md`
- `docs/projects/puzzles/GAPS.md`
- `docs/projects/puzzles/DECISIONS.md`
- `docs/projects/puzzles/AUDIT_OR_PROOF.md`
- `docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md`
- `docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md`

## Iteration Rules

- Keep changes bounded to the active gap only.
- Avoid touching unrelated systems or broad doc surfaces.
- Preserve unfinished intent in unchanged files.
- If a blocker is found, document it in `GAPS.md` with next action and proof target before widening scope.
- After each pass, update `COLD_START_AGENT_PROMPT.md` with a single current handoff block.

## Current Iteration (Iteration 7) Flow

1. Confirm `T4` is marked done in `TRACKER.md`, `PZ-007` is resolved in `GAPS.md`, and `PZ-003` is the active next task.
2. Keep the next pass focused on key-based lock progression ownership and deterministic unlock behavior.
3. Update required docs:
   - `NORTH_STAR.md`
   - `TRACKER.md`
   - `GAPS.md`
   - `COLD_START_AGENT_PROMPT.md`
4. Add iteration records to:
   - `AUDIT_OR_PROOF.md`
   - `RUNBOOK.md`
   - `DECISIONS.md` only if a new decision is introduced.
5. Run scoped verification:
   - focused puzzle/key tests added or updated by the slice
   - `npm run projects:audit`
   - `git diff --check` before finish.

## Verification

A pass is considered settled when:

- Production lockpicking and first puzzle hint dispatch routes are validated in focused tests or equivalent proof.
- Dashboard files reflect aligned status/proof.
- No review-required decision has surfaced requiring cross-team/blocking handoff.

## Completed Runtime Caller Branch

`PZ-007` is closed. Do not re-open the ownership question unless new evidence
contradicts the implementation.

- Keep `PZ-002` as resolved helper work.
- Keep `PZ-007` as resolved runtime-caller work.
- Continue with `PZ-003` next, and do not widen into BattleMap/Submap integration from that branch.
