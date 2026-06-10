# Economy UI Gaps

Status: active
Last updated: 2026-06-09

Use this file for durable integration gaps that must be carried into implementation.

## Iteration notes

- 2026-06-05 | economy-ui workflow pass | Reviewed the current handoff against `GLOBAL_GAPS.md` and `WORKFLOW_GAPS.md`; no new project-specific blocker surfaced, so the existing G1-G3 set became the active gap surface for this iteration.
- 2026-06-09 | economy-ui modal wiring pass | Resolved G1 (Ledger/Courier not mounted) by adding modal hosts plus `TOGGLE_*` close dispatch in `GameModals.tsx` and by routing open actions through `App.tsx`/`DevMenu.tsx`.
- 2026-06-09 | economy-ui close-path parity pass | Extended modal-close regression coverage: fallback `Escape` now has explicit close proof for both `LedgerBook` and `CourierPouch` in `src/components/layout/__tests__/GameModals.test.tsx`.
- 2026-06-09 | economy-ui action-entry pass | Resolved G2 by mounting `InvestmentBoard` in `GameModals`, wiring caravan and loan callbacks to `INVEST_IN_CARAVAN` and `TAKE_LOAN`, and giving Dev Menu a direct close-and-open entry for the board.
- 2026-06-09 | economy-ui ownership contract pass | Resolved G3 by documenting the intentional reducer split instead of migrating visibility flags, so the board/route surfaces stay in `uiReducer` and the ledger/courier surfaces stay in `economyReducer`.

## Gap log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | resolved | in_scope_now | Economy UI docs owner | `src/components/layout/GameModals.tsx` / `src/App.tsx` / `src/components/debug/DevMenu.tsx` | economy UI scan | `LedgerBook` and `CourierPouch` were not mounted in `GameModals` and had no practical open path. | `src/components/layout/GameModals.tsx`, `src/components/Economy/LedgerBook.tsx`, `src/components/Economy/CourierPouch.tsx`, `src/state/actionTypes.ts`, `src/App.tsx`, `src/components/debug/DevMenu.tsx` | Hidden economy surfaces reduced feature completeness and blocked parity with implemented state/actions. | Open/close paths now route through explicit toggles and modal mounts in `GameModals.tsx`. | Test proof from `src/components/layout/__tests__/GameModals.test.tsx` and `src/components/debug/__tests__/DevMenu.test.tsx` for mount and action dispatch. |
| G2 | resolved | in_scope_now | Economy UI docs owner | `src/components/Economy/InvestmentBoard.tsx` / `src/components/layout/GameModals.tsx` / `src/components/debug/DevMenu.tsx` | economy UI scan | `InvestmentBoard` callback props were optional and not provided, so caravan and loan buttons were inert. | `src/components/Economy/InvestmentBoard.tsx`, `src/components/layout/GameModals.tsx`, `src/components/debug/DevMenu.tsx`, `src/state/actionTypes.ts`, `src/state/reducers/uiReducer.ts`, `src/components/layout/__tests__/GameModals.test.tsx`, `src/components/debug/__tests__/DevMenu.test.tsx` | The board now routes player investment and loan intents to the existing economy actions and has a live developer entry point for proof. | Keep the board mounted through the shared modal host and preserve the direct dev-menu open path for test access. | `GameModals.test.tsx` and `DevMenu.test.tsx` prove dispatch wiring for `INVEST_IN_CARAVAN` and `TAKE_LOAN`. |
| G3 | resolved | adjacent_follow_up | Economy UI docs owner | `src/state/reducers/uiReducer.ts` / `src/state/reducers/economyReducer.ts` | state split audit | UI visibility flags are intentionally split across reducers: route dashboard and investment board in `uiReducer`, ledger and courier in `economyReducer`. | `src/state/reducers/uiReducer.ts`, `src/state/reducers/economyReducer.ts`, `src/state/initialState.ts`, `docs/projects/economy-ui/NORTH_STAR.md`, `docs/projects/economy-ui/DECISIONS.md` | The split is now explicit, so the ownership contract is visible without moving flags around or changing action behavior. | Keep the documented split stable unless a future reducer migration is explicitly approved. | `NORTH_STAR.md` and `DECISIONS.md` now record the ownership contract; `git diff --check` confirms the docs edits are clean. |

## Classification reference

- in_scope_now: required to continue the feature safely.
- adjacent_follow_up: useful but not blocking initial implementation.
- blocked_human_decision: requires explicit owner choice.
- blocked_external_state: requires outside actor or external data.

## Rule

- Move purely technical debt or non-UI concerns to the appropriate parent project tracker.
