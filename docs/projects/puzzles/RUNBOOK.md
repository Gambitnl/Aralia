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

## Current Iteration (Iteration 4) Flow

1. Confirm `T3` is marked done in `TRACKER.md`, `PZ-002` is marked done in `GAPS.md`, and `PZ-007` is review-required.
2. Keep evidence in this pass to puzzle helper -> deterministic hint test -> caller-gap split, then stop if no runtime `Puzzle` owner exists.
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
   - `npm test -- --run src/systems/puzzles/__tests__/puzzleSystem.test.ts`
   - `node scripts/audit-living-project-docs.cjs`
   - `git diff --check` before finish.

## Verification

A pass is considered settled when:

- Production lockpicking dispatch route is validated in test or equivalent proof.
- Dashboard files reflect aligned status/proof.
- No review-required decision has surfaced requiring cross-team/blocking handoff.

## Review-Required Branch

If the source scan finds no runtime caller that can own a real `Puzzle` object, stop the implementation slice there and record the ownership question in the Required Review Brief.

- Keep `PZ-002` as resolved helper work.
- Mark `PZ-007` review-required until a human owner chooses the first gameplay surface.
- Do not widen into PZ-003 key unlock work or BattleMap/Submap integration from this branch.
