# Scripts: Archive Living Tracker

Status: active
Last updated: 2026-06-17

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
| T2 | review-required | Verify deprecation/cleanup policy for archived scripts and temporary auth artifacts | Qoder CLI | 2026-06-17 | Required Review Brief in `NORTH_STAR.md`; `Test-Path .agent/roadmap-local/spell-validation/dndbeyond-auth.json` returned `False` on 2026-06-17 | Human operator decides tombstone policy (Option A/B/C in Required Review Brief); re-run temp-auth check only if artifact is recreated | Operator decision recorded in `DECISIONS.md`; tombstone entry or policy note committed |

## Gap Log

- See `docs/projects/scripts-archive/GAPS.md` for durable follow-up items.

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
