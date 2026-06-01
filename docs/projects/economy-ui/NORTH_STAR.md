# Economy UI North Star

Status: active
Last updated: 2026-05-31

## Purpose and scope

This project tracks how economy-facing UI is surfaced in game and how it connects to system state.

In scope:
- Trading and economy display surfaces.
- Modal visibility and dispatch wiring for player access.
- Cross-project relationship to the economy simulation system.

Out of scope:
- Economy simulation math, route updates, and pricing model changes.
- Business rule changes outside user-visible economy UI.

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
  - Overlay host for modal mounting.
- src/state/initialState.ts
  - `isTradeRouteDashboardVisible`, `isEconomyLedgerVisible`, `isCourierPouchVisible`,
    and economy runtime fields.
- src/state/reducers/uiReducer.ts
  - `TOGGLE_TRADE_ROUTE_DASHBOARD` reducer behavior.
- src/state/reducers/economyReducer.ts
  - Economy actions plus `TOGGLE_ECONOMY_LEDGER` and `TOGGLE_COURIER_POUCH`.
- src/state/actionTypes.ts
  - Economy action and ui action type registry.
- src/components/debug/DevMenu.tsx
  - Toggle entry for trade route dashboard.
- src/App.tsx
  - Developer action dispatch for trade route dashboard.

## Implemented state

- Merchant flow is mounted and uses economy context through `calculatePrice` in
  `src/utils/economy/economyUtils.ts`.
- `TradeRouteDashboard` is mounted and can be toggled.
- `LedgerBook`, `InvestmentBoard`, and `CourierPouch` are implemented and reference real state slices, but are not yet mounted in `GameModals`.
- Economy reducer can apply player investment/loan actions and return updated investment and gold state.
- Economy UI flags are present in initial state.

## Integration status

- Merchants connect town actions to `OPEN_MERCHANT` via
  `handleOpenDynamicMerchant`.
- Dynamic pricing path:
  - Merchant modal
  - Economy state (`marketFactors`, `activeEvents`, `marketEvents`, `tradeRoutes`)
  - Faction standings and region context.
- There is a split ownership:
  - Route dashboard toggle lives in UI reducer.
  - Ledger/courier toggles live in economy reducer.
- `InvestmentBoard` has optional callbacks (`onInvestInCaravan`, `onTakeLoan`) but currently no parent wiring.

## Relation to docs/projects/economy

This project is the front-end surface for the economy system described in
`docs/projects/economy/*.md`.
That project owns simulation, route math, market events, loans, and business progression.
This project owns where and how that state is surfaced to the player.

## Gaps to resolve next

- Wire `LedgerBook` and `CourierPouch` into modal host with open/close actions.
- Connect `InvestmentBoard` callbacks to `INVEST_IN_CARAVAN` and `TAKE_LOAN` dispatch.
- Decide whether ledger/courier toggles should move into the ui reducer for ownership consistency.

## Next checks

- Confirm UI entry points for all three economy modal surfaces.
- Verify no duplicate or dead economy flags remain after wiring.
- Add doc check pass for cross-project references between economy and economy-ui.

## Resume path

1. Read this file.
2. Read `docs/projects/economy-ui/TRACKER.md`.
3. Read `docs/projects/economy-ui/GAPS.md`.
4. Compare required changes with `docs/projects/economy/NORTH_STAR.md`.
