# Economy UI Tracker

Status: active
Last updated: 2026-05-31

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
| T2 | active | Prepare implementation-safe integration plan for missing modal wiring. | Economy UI docs owner | 2026-05-31 | `src/components/layout/GameModals.tsx`, `src/components/Economy/*.tsx` | Add concrete wiring plan in active task runner or implementation PR notes | Confirm open action paths and verify with source of truth checks |
| T3 | active | Resolve entry-point strategy for Ledger and Courier UI. | Economy UI docs owner | 2026-05-31 | `src/App.tsx`, `src/components/debug/DevMenu.tsx`, `src/state/actionTypes.ts` | Decide if these are dev-only or in-world actions | Add one action dispatch route and test open/close behavior |
| T4 | active | Confirm toggle ownership boundaries for economy UI visibility. | Economy UI docs owner | 2026-05-31 | `src/state/reducers/economyReducer.ts`, `src/state/reducers/uiReducer.ts` | Align reducer ownership for visibility flags | Add note in this tracker once approved |

## Integration notes

- `TradeRouteDashboard` is currently the only economy-facing modal that is definitely mounted.
- Ledger and courier modals are not mounted in `GameModals`, despite having reducers and state flags.
- `InvestmentBoard` rendering logic is present but callback paths are unbound.

## Rule

- Keep unresolved cross-cutting integration questions that block implementation in `GAPS.md` with concrete proof references.
- Keep durable implementation-only evidence in this tracker, not in branch logs or scratch output.
