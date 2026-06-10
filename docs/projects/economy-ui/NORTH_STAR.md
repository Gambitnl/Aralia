---
schema_version: 1
project: Economy UI
slug: economy-ui
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-09
confidence: medium
evidence: docs/projects/economy-ui
gap_signal: 0 open gaps
protocol: living project doc set
next_step: "Preserve the documented reducer split; only revisit visibility normalization if a future reducer migration is explicitly approved."
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
  - tasks/
  - architecture notes
  - migration notes
required_verification:
  - scoped_tests
  - docs_consistency
completed_verification:
  - scoped_tests
  - docs_consistency
last_proof: 2026-06-09
workflow_gaps_reviewed: 2026-06-09
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Economy UI North Star

Status: active
Last updated: 2026-06-09

## Purpose and scope

This project tracks how economy-facing UI is surfaced in game and how it connects to system state.

In scope:
- Trading and economy display surfaces.
- Modal visibility and dispatch wiring for player access.
- Cross-project relationship to the economy simulation system.

Out of scope:
- Economy simulation math, route updates, and pricing model changes.
- Business rule changes outside user-visible economy UI.

## Current state

- Active slice: T3 and T4 are now complete and should be considered the evidence-backed action-entry and ownership passes for this iteration.
- Secondary open slice: none. T4 is now complete and the ownership question is resolved as a documentation-only contract.
- Resume path: preserve the modal hosting model from T2 and the documented reducer split; only reopen if a future reducer migration is requested.

## Dashboard Card Schema

Project: Economy UI
Slug: economy-ui
Category: Feature/UI Projects
Status: active
Confidence: medium
Evidence: `docs/projects/economy-ui`
Gap signal: 0 open gaps
Protocol: living project doc set
Next step: Preserve the documented reducer split; only revisit visibility normalization if a future reducer migration is explicitly approved.
Required verification: scoped_tests, docs_consistency
Completed verification: scoped_tests, docs_consistency
Last proof: 2026-06-09
Workflow gaps reviewed: 2026-06-09

## File map

- src/components/Trade/MerchantModal.tsx
  - Live merchant/shop UI with trade and rumor tabs.
- src/components/Trade/TradeRouteDashboard.tsx
  - Trade route monitor dashboard.
- src/components/Trade/RouteCard.tsx
  - Route summary card.
- src/components/Trade/MarketEventCard.tsx
  - Market event display card.
- src/components/Economy/LedgerBook.tsx
  - Player finance display with treasury, investments, businesses, debts tabs.
- src/components/Economy/InvestmentBoard.tsx
  - Caravan, loan, and speculation opportunities UI.
- src/components/Economy/CourierPouch.tsx
  - Courier messages and market intel letters.
- src/components/Economy/index.ts
  - Barrel exports for economy components.
- src/components/layout/GameModals.tsx
  - Overlay host for modal mounting, including `InvestmentBoard` callback wiring.
- src/components/debug/DevMenu.tsx
  - Shared developer surface for opening economy UI modals during test passes.
- src/state/initialState.ts
  - `isTradeRouteDashboardVisible`, `isInvestmentBoardVisible`, `isEconomyLedgerVisible`, `isCourierPouchVisible`,
    and economy runtime fields.
- src/state/reducers/uiReducer.ts
  - `TOGGLE_TRADE_ROUTE_DASHBOARD` and `TOGGLE_INVESTMENT_BOARD` reducer behavior.
- src/state/reducers/economyReducer.ts
  - Economy actions plus `TOGGLE_ECONOMY_LEDGER` and `TOGGLE_COURIER_POUCH`.
- src/state/actionTypes.ts
  - Economy action and ui action type registry, including `TOGGLE_INVESTMENT_BOARD`.
- src/App.tsx
  - Global interaction gating now pauses background flow while the investment board is open.
- src/utils/core/timekeeperUtils.ts
  - Passive clock gate includes the investment board modal as a pause condition.

## Implemented state

- Merchant flow is mounted and uses economy context through `calculatePrice` in
  `src/utils/economy/economyUtils.ts`.
- `TradeRouteDashboard` is mounted and can be toggled.
- `LedgerBook` and `CourierPouch` are now mounted in `GameModals` and close via
  economy toggle actions; fallback Escape handling is tested for both.
- `InvestmentBoard` is implemented, mounted in `GameModals`, and its caravan and
  loan buttons now dispatch `INVEST_IN_CARAVAN` and `TAKE_LOAN`.
- The reducer ownership contract is now documented and intentional:
  - `uiReducer` owns `isTradeRouteDashboardVisible` and `isInvestmentBoardVisible`.
  - `economyReducer` owns `isEconomyLedgerVisible` and `isCourierPouchVisible`.
- Economy reducer can apply player investment/loan actions and return updated investment and gold state.
- Economy UI flags are present in initial state.

## Integration status

- Merchants connect town actions to `OPEN_MERCHANT` via
  `handleOpenDynamicMerchant`.
- Dynamic pricing path:
  - Merchant modal
  - Economy state (`marketFactors`, `activeEvents`, `marketEvents`, `tradeRoutes`)
  - Faction standings and region context.
- There is an intentional split ownership contract:
  - Route dashboard and investment board toggles live in the UI reducer.
  - Ledger and courier toggles live in the economy reducer.
  - `GameModals` remains the single host for all four surfaces.
- `InvestmentBoard` now routes optional callbacks from `GameModals` to the existing economy actions, and the Dev Menu has a direct close-and-open path for the board.

## Relation to docs/projects/economy

This project is the front-end surface for the economy system described in
`docs/projects/economy/*.md`.
That project owns simulation, route math, market events, loans, and business progression.
This project owns where and how that state is surfaced to the player.

## Gaps to resolve next

- No open project gap remains for reducer ownership. If visibility normalization is ever requested, treat it as a separate reducer-migration review.
- Confirm whether player-facing in-world entry points are needed for `InvestmentBoard` beyond the Dev Menu launch path.

## Next checks

- Confirm UI entry points for in-world and dev-menu economy surfaces.
- Verify no duplicate or dead economy flags remain after wiring and close paths.
- Add doc check pass for cross-project references between economy and economy-ui.

## Resume path

1. Read this file.
2. Read `docs/projects/economy-ui/TRACKER.md`.
3. Read `docs/projects/economy-ui/GAPS.md`.
4. Compare required changes with `docs/projects/economy/NORTH_STAR.md`.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first, then read the existing project gaps
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
