# Scripts: Archive Living Tracker

Status: active
Last updated: 2026-06-05

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
| T2 | active | Verify deprecation/cleanup policy for archived scripts and temporary auth artifacts | Worker C | 2026-06-05 | `docs/projects/scripts-archive/NORTH_STAR.md`, `docs/projects/scripts-archive/GAPS.md`, `Test-Path .agent/roadmap-local/spell-validation/dndbeyond-auth.json` | Record the archive tombstone decision or explicit no-tombstone rule in the project docs | Re-run `Test-Path .agent/roadmap-local/spell-validation/dndbeyond-auth.json` if the temp auth artifact is ever recreated |

## Gap Log

- See `docs/projects/scripts-archive/GAPS.md` for durable follow-up items.

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
