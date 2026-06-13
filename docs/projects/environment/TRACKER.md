# Environment System Living Tracker

Status: active
Last updated: 2026-06-09

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

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Notes

- All entries above are local to this project unless moved explicitly to another owning tracker.
- `T3` now names the first runtime slice directly so the next cold start can move from docs to implementation without guesswork.
- `T4` is complete and `G2` is resolved; `G3`, `G4`, and `G5` are now resolved as well, so the next safe environment slice will come from the next tracker gap.
- Keep updates documentation-first until execution approval; this file is evidence of the intended next slice.

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
