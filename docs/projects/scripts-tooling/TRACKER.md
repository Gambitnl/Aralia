# Scripts: Tooling Living Tracker

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
| ST-2 | not_started | Decide whether to align script-tracker adoption for more tooling scripts | Worker C | 2026-06-05 | `scripts/tooling/script-tracker.ts` | Add explicit `trackRun` usage and re-check run-log coverage, or document why coverage stays selective | Run a scan for missing `@script-meta` across `scripts/` and compare to `.run-log.json` |

## Gap Log

- No durable project-level gap rows are tracked here; unresolved findings are in `GAPS.md`.

## Update Rules

- Update this tracker before active work begins and at least once per substantial doc correction.
- Any row in active/waiting/blocked must include owner, evidence, next action, and next proof.
- Open gaps are tracked in the local project gap file unless they are clearly out of project scope.
