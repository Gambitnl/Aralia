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
| T1 | done | Create docs-only cold-start protocol for Economy UI (`NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`). | Economy UI docs owner | 2026-05-31 | `docs/projects/economy-ui/*.md`, `src/components/Economy/*` | Keep this documentation as source for implementation handoff | Verify scope and gap IDs are present in this folder |
| T2 | done | Prepare implementation-safe integration plan for missing modal wiring. | Economy UI docs owner | 2026-06-09 | `src/components/layout/GameModals.tsx`, `src/components/Economy/*.tsx` | Confirm mount + dispatch close paths are implemented for `LedgerBook` and `CourierPouch` | Verify modal close flow with fallback or action-dispatch proof |
| T3 | done | Route `InvestmentBoard` action-entry through the shared modal host and Dev Menu. | Economy UI docs owner | 2026-06-09 | `src/components/Economy/InvestmentBoard.tsx`, `src/components/layout/GameModals.tsx`, `src/components/debug/DevMenu.tsx`, `src/state/actionTypes.ts`, `src/state/reducers/uiReducer.ts`, `src/components/layout/__tests__/GameModals.test.tsx`, `src/components/debug/__tests__/DevMenu.test.tsx` | Preserve the modal host path and revisit non-dev entry only if a future product request appears | Focused regression tests now prove caravan and loan buttons dispatch the existing economy actions |
| T4 | done | Confirm toggle ownership boundaries for economy UI visibility. | Economy UI docs owner | 2026-06-09 | `src/state/reducers/economyReducer.ts`, `src/state/reducers/uiReducer.ts`, `docs/projects/economy-ui/NORTH_STAR.md`, `docs/projects/economy-ui/DECISIONS.md`, `docs/projects/economy-ui/GAPS.md` | Keep the documented reducer split unless a future migration is explicitly approved | Ownership is now documented as a stable split rather than a migration candidate |
| T5 | done | Normalize tracker and gaps to single-table living-project workflow contract. | Claude Opus 4.6 / Antigravity | 2026-06-10 | `docs/projects/economy-ui/TRACKER.md`, `docs/projects/economy-ui/GAPS.md` | Preserve normalized structure; do not re-append template tables | Docs pass `git diff --check`; no duplicate table sections remain |

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
