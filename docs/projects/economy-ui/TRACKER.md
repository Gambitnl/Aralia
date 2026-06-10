# Economy UI Tracker

Status: active
Last updated: 2026-06-09

## Status vocabulary

- not_started
- active
- waiting
- blocked
- done
- superseded
- out_of_scope

## Active task queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|---|
| T1 | done | Create docs-only cold-start protocol for Economy UI (`NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`). | Economy UI docs owner | 2026-05-31 | `docs/projects/economy-ui/*.md`, `src/components/Economy/*` | Keep this documentation as source for implementation handoff | Verify scope and gap IDs are present in this folder |
| T2 | done | Prepare implementation-safe integration plan for missing modal wiring. | Economy UI docs owner | 2026-06-09 | `src/components/layout/GameModals.tsx`, `src/components/Economy/*.tsx` | Confirm mount + dispatch close paths are implemented for `LedgerBook` and `CourierPouch` | Verify modal close flow with fallback or action-dispatch proof |
| T3 | done | Route `InvestmentBoard` action-entry through the shared modal host and Dev Menu. | Economy UI docs owner | 2026-06-09 | `src/components/Economy/InvestmentBoard.tsx`, `src/components/layout/GameModals.tsx`, `src/components/debug/DevMenu.tsx`, `src/state/actionTypes.ts`, `src/state/reducers/uiReducer.ts`, `src/components/layout/__tests__/GameModals.test.tsx`, `src/components/debug/__tests__/DevMenu.test.tsx` | Preserve the modal host path and revisit non-dev entry only if a future product request appears | Focused regression tests now prove caravan and loan buttons dispatch the existing economy actions |
| T4 | done | Confirm toggle ownership boundaries for economy UI visibility. | Economy UI docs owner | 2026-06-09 | `src/state/reducers/economyReducer.ts`, `src/state/reducers/uiReducer.ts`, `docs/projects/economy-ui/NORTH_STAR.md`, `docs/projects/economy-ui/DECISIONS.md`, `docs/projects/economy-ui/GAPS.md` | Keep the documented reducer split unless a future migration is explicitly approved | Ownership is now documented as a stable split rather than a migration candidate |

## Integration notes

- `TradeRouteDashboard`, `LedgerBook`, and `CourierPouch` are now mounted by `GameModals`.
- `InvestmentBoard` now mounts in `GameModals`, closes through Escape, and dispatches the caravan/loan economy actions from the live buttons.
- The reducer ownership contract is documented: `uiReducer` owns the route dashboard and investment board visibility flags, while `economyReducer` owns the ledger and courier visibility flags.
- T4 is complete; no reducer migration is required for this pass.

## Rule

- Keep unresolved cross-cutting integration questions that block implementation in `GAPS.md` with concrete proof references.
- Keep durable implementation-only evidence in this tracker, not in branch logs or scratch output.
