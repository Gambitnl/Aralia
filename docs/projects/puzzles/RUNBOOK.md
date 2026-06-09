# Puzzles System Runbook

Status: active
Last updated: 2026-06-09

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

## Current Iteration (Iteration 3) Flow

1. Confirm `T2` is marked done in `TRACKER.md` and `PZ-001` is marked done in `GAPS.md`.
2. Keep evidence in this pass to world feature -> action generation -> handler dispatch -> tested payload.
3. Update required docs:
   - `NORTH_STAR.md`
   - `TRACKER.md`
   - `GAPS.md`
   - `COLD_START_AGENT_PROMPT.md`
4. Add iteration records to:
   - `DECISIONS.md`
   - `AUDIT_OR_PROOF.md`
   - `RUNBOOK.md`
5. Run scoped verification:
   - `npm run test -- src/components/ActionPane/__tests__/ActionPane.test.tsx`
   - `git diff --check -- <tracked touched files>` before finish.

## Verification

A pass is considered settled when:

- Production lockpicking dispatch route is validated in test or equivalent proof.
- Dashboard files reflect aligned status/proof.
- No review-required decision has surfaced requiring cross-team/blocking handoff.
