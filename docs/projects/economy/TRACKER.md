# Economy System Living Tracker

Status: active
Last updated: 2026-06-12

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`
## Status vocabulary

- not_started
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Evidence | Last updated | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|

## Tracking rules

- Update row status when proof/check status changes.
- Add only durable decisions here if they block or materially alter the implementation path.
- Raw logs and local run outputs belong to transient workflow records unless condensed into a durable proof note.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
