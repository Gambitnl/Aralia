# <Project Or Task> Living Tracker

Status: active
Last updated: <YYYY-MM-DD>

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
| T1 | active | <task> | <owner> | <YYYY-MM-DD> | <evidence> | <next> | <proof> |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | <owner> | <tracker> | <task> | <gap> | <source> | <why> | <next> | <proof> |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence
  or next proof, and next action.
- Record new gaps and source-backed expansion opportunities here or link the
  owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
