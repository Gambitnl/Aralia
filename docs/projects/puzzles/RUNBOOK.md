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

## Current Iteration (Iteration 9) Flow

1. Confirm `T4`, `T5`, and `T6` are marked done in `TRACKER.md`, and `PZ-007`, `PZ-003`, plus `PZ-004` are resolved in `GAPS.md`.
2. Treat deterministic key resolution as puzzle-runtime complete: callers provide key ids, and `attemptKeyUnlock` compares them to `Lock.keyId`.
3. Treat puzzle runtime character ability checks as modern-first: `finalAbilityScores` first, then `abilityScores`, with `character.stats` retained only as compatibility fallback through `getPuzzleCharacterStats`.
4. Keep inventory/economy key sourcing, visible modal key use, broad character-model cleanup, and caller-side stat adapter updates out of this closure unless a future slice explicitly takes that work.
5. Update required docs:
   - `NORTH_STAR.md`
   - `TRACKER.md`
   - `GAPS.md`
   - `COLD_START_AGENT_PROMPT.md`
6. Add iteration records to:
   - `AUDIT_OR_PROOF.md`
   - `RUNBOOK.md`
   - `DECISIONS.md` only if a new decision is introduced.
7. Run scoped verification:
   - focused puzzle runtime tests added or updated by the slice
   - dependency sync for touched exported puzzle contract files
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
- Keep `PZ-003` as resolved runtime key-matching work, and do not widen it into inventory/economy sourcing or BattleMap/Submap integration.
- Keep `PZ-004` as resolved runtime stat-bridge work, and do not reintroduce copied legacy-first shims in future puzzle checks.
