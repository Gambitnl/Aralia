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
- When closing a task with no new gap found, name the adjacent components and
  active edge-case/chaos probes checked in the evidence or next-proof field.
  Do not use "no gaps found" unless the sweep tested nearby boundaries, not
  only touched files.
- Keep raw process artifacts out unless a concise summary helps future work.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/agent-workflows/living-project-task-protocol/templates/LIVING_TRACKER.md","sha256WithoutMarker":"5d6dd127a575eb0e8438cde8567e5a3bd7f18620e91ac35523825b84563d8059","markedAtUtc":"2026-06-25T22:57:26.963Z"} -->
