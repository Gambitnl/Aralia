# TRACKER: Scripts: Git

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
| T1 | done | Align and confirm protocol surface for Scripts: Git | Worker C | 2026-05-31 | [docs/projects/PROJECT_TRACKER.md](docs/projects/PROJECT_TRACKER.md) | Keep protocol files aligned and scoped to `scripts/git` | `Test-Path docs/projects/scripts-git/NORTH_STAR.md` |
| T2 | done | Refresh Scripts: Git docs with explicit policy map, CI/local integration, and gap list | Worker C | 2026-06-05 | [docs/projects/scripts-git/NORTH_STAR.md](docs/projects/scripts-git/NORTH_STAR.md), [docs/projects/scripts-git/COLD_START_AGENT_PROMPT.md](docs/projects/scripts-git/COLD_START_AGENT_PROMPT.md), [docs/projects/scripts-git/GAPS.md](docs/projects/scripts-git/GAPS.md) | Hand off the next slice with G1 as the first in-scope gap | `git diff --check` and a cold-start read of the refreshed docs |

## Gap Log

- In-scope gaps:
  - `G1` not started: tests for scripts/git policy behavior are not yet documented as durable checks.
  - `G2` not started: no runbook file exists yet for explicit one-command policy verification.

- Runtime/hook behavior questions remain in implementation ownership and are not edited in this pass.
