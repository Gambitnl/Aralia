# Command Base Runtime Living Tracker

Status: active
Last updated: 2026-06-08

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

- `T3` **completed** â€” rollback policy decided: `executeWithRollback` is not adopted as production path.
- `T4` **completed** â€” `CommandExecutor.execute` failure path now covered for async errors, partial execution, and pre-failure snapshot behavior.
- `G1`: **closed** â€” rollback API has no call-site requirement in production; no change needed.
- `G2`: **closed** â€” undo methods are not required for current non-rollback policy.
- `G3`: **closed** â€” failure-path coverage for async errors and immutability guarantees added in tests.
- `G4`: done â€” state-freshness contract follow-up complete and locked by focused test.

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
