# Economy UI Living Tracker

Status: active
Last updated: 2026-06-10

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

## Integration Notes

- `TradeRouteDashboard`, `LedgerBook`, and `CourierPouch` are now mounted by `GameModals`.
- `InvestmentBoard` now mounts in `GameModals`, closes through Escape, and dispatches the caravan/loan economy actions from the live buttons.
- The reducer ownership contract is documented: `uiReducer` owns the route dashboard and investment board visibility flags, while `economyReducer` owns the ledger and courier visibility flags.
- T4 is complete; no reducer migration is required for this pass.
- No player-facing (non-dev-menu) entry points exist yet for InvestmentBoard, LedgerBook, or CourierPouch.

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
