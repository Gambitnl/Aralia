# Scripts: Tooling Living Tracker

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
| ST-2 | done | Decide whether to align script-tracker adoption for more tooling scripts | Qoder CLI | 2026-06-17 | `scripts/tooling/script-tracker.ts`, `scripts/tooling/.run-log.json`, `scripts/tooling/serialize-session-proof.ts` | Decision recorded: `trackRun()` adoption stays intentionally selective. Only standalone entry-point scripts should be tracked; libraries and agent-only helpers are excluded by design. | Verified: 1/15 tooling scripts calls `trackRun()`, 5/15 have run-log entries, 10/15 are libraries/helpers with no standalone execution. Decision documented in DECISIONS.md D2. |

## Closed Task Log

| ID | Status | Task | Closed | Decision |
|---|---|---|---|---|
| ST-2 | done | Decide whether to align script-tracker adoption for more tooling scripts | 2026-06-17 | `trackRun()` stays intentionally selective. See DECISIONS.md D2. |

## Gap Log

- No durable project-level gap rows are tracked here; unresolved findings are in `GAPS.md`.

## Update Rules

- Update this tracker before active work begins and at least once per substantial doc correction.
- Any row in active/waiting/blocked must include owner, evidence, next action, and next proof.
- Open gaps are tracked in the local project gap file unless they are clearly out of project scope.
