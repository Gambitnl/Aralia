# Economy UI Gaps

Status: active
Last updated: 2026-06-05

Use this file for durable integration gaps that must be carried into implementation.

## Iteration notes

- 2026-06-05 | economy-ui workflow pass | Reviewed the current handoff against `GLOBAL_GAPS.md` and `WORKFLOW_GAPS.md`; no new project-specific blocker surfaced, so the existing G1-G3 set remains the active gap surface.

## Gap log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | in_scope_now | in_scope_now | Economy UI docs owner | `src/components/layout/GameModals.tsx` / `src/App.tsx` | economy UI scan | `LedgerBook` and `CourierPouch` are not mounted in the modal host, so player cannot open them from game flow. | `src/components/layout/GameModals.tsx`, `src/components/Economy/LedgerBook.tsx`, `src/components/Economy/CourierPouch.tsx`, `src/state/actionTypes.ts` | Hidden economy surfaces reduce feature completeness and block parity with implemented logic. | Add modal mount points and dispatch actions for open/close. | Manual open/close proof and reducer state assertions for `isEconomyLedgerVisible` and `isCourierPouchVisible`. |
| G2 | in_scope_now | in_scope_now | Economy UI docs owner | `src/components/Economy/InvestmentBoard.tsx` / `src/App.tsx` | economy UI scan | `InvestmentBoard` callback props are optional and currently not provided, so caravan and loan buttons are inert. | `src/components/Economy/InvestmentBoard.tsx`, `src/state/actionTypes.ts` | Player has no way to execute the investment and loan actions from this surface. | Wire `onInvestInCaravan` and `onTakeLoan` handlers through `GameModals` or a dedicated host. | Add interaction test dispatching `INVEST_IN_CARAVAN` and `TAKE_LOAN` when board buttons are used. |
| G3 | adjacent_follow_up | adjacent_follow_up | Economy UI docs owner | `src/state/reducers/uiReducer.ts` / `src/state/reducers/economyReducer.ts` | state split audit | UI visibility flags are owned across reducers (`trade` in ui reducer, `ledger`/`courier` in economy reducer). | `src/state/reducers/uiReducer.ts`, `src/state/reducers/economyReducer.ts`, `src/state/initialState.ts` | Flag ownership split may increase cognitive load and hide reducer intent. | Confirm ownership decision before large integration pass. | Document final ownership in `NORTH_STAR.md` and keep action behavior stable. |

## Classification reference

- in_scope_now: required to continue the feature safely.
- adjacent_follow_up: useful but not blocking initial implementation.
- blocked_human_decision: requires explicit owner choice.
- blocked_external_state: requires outside actor or external data.

## Rule

- Move purely technical debt or non-UI concerns to the appropriate parent project tracker.
