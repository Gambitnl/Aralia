# <Project Or Task> North Star

Status: active
Last updated: <YYYY-MM-DD>

Dashboard schema: fill `docs/projects/PROJECT_CARD_SCHEMA.md` YAML frontmatter
when converting this template into a project file. The `gap_signal` field must
start with a parseable count such as `0 open gaps`, `1 open gap`, or
`<N> open gaps` before any summary details.

## Why This Project Exists

<Why this task became a project and what risk the North Star protects against.>

## Intended Outcome

<What outcome are we trying to create?>

## Current State

<Short factual state summary. On first creation, say this is the initial
project surface and name what evidence still needs to be gathered.>

## Active Task

| Field | Value |
|---|---|
| Task | <bounded active slice> |
| Acceptance criteria | <how this slice is complete> |
| Allowed boundaries | <files/systems/areas that may be touched> |
| Stop condition | <where to stop instead of widening scope> |
| Verification | <command or evidence source> |
| Owner | <agent/person/system> |
| Next action | <next concrete step> |

## Scope Boundaries

In scope:
- <...>

Adjacent but not in this slice:
- <...>

Out of scope:
- <...>

## What Must Not Be Lost

- <Unfinished intent, optionality, partial systems, fragile evidence, or
  accepted boundary that future agents must preserve.>

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| <gap> | <classification> | <owner> | <source> | <next> |

## Global Gap Imports

Check the global gap tracker before creating this project surface:
`docs/projects/GLOBAL_GAPS.md`.

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| <GG-id> | <yes/no> | <project gap ID or none> | <why it does or does not belong here> |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| <summary> | <proof value> | <path/link/command> |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Repo-level project registry | active |
| `<living-tracker-file>` | Active queue, blockers, gaps, next actions | active |
| `docs/projects/GLOBAL_GAPS.md` | Cross-project and out-of-scope gap surfacing | active |
| `<optional-path>` | `<why it exists>` | `<planned/active/done>` |

## Artifact Boundary

Track durable intent, decisions, verification summaries, promoted proof, and
next actions. Keep raw logs, generated files, temporary screenshots, caches,
and local run state external or ignored unless a concise summary or proof
excerpt is useful later.

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| <question> | <why> | <owner> | <date or task> |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `<living-tracker-file>`.
3. Read `<active-task-or-package-file>` if one exists.
4. Check `<evidence source or verification command>`.
5. Continue from: `<next action>`.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/agent-workflows/living-project-task-protocol/templates/NORTH_STAR.md","sha256WithoutMarker":"7eb9c267f3b049859d16d5a40b5393f5b1bf4e2b5e79689fbae139ab7e190f59","markedAtUtc":"2026-06-25T22:57:26.964Z"} -->
