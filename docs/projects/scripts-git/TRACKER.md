# Scripts: Git Living Tracker

Status: active
Last updated: 2026-06-05

## Current State

- The docs refresh pass is complete.
- No code, CI, or hook behavior changed in this iteration.
- The next meaningful slice is G1 from `GAPS.md`, unless the owner wants the runbook follow-up first.

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
|---|---|---|---|---|---|---|---|

## Gap Log

- In-scope gaps:
  - `G1` not started: tests for scripts/git policy behavior are not yet documented as durable checks.
  - `G2` not started: no runbook file exists yet for explicit one-command policy verification.

- Runtime/hook behavior questions remain in implementation ownership and are not edited in this pass.

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
