# Economy UI Audit / Proof

Status: active
Last updated: 2026-06-09

## Proof

- `npx vitest run src/components/layout/__tests__/GameModals.test.tsx src/components/debug/__tests__/DevMenu.test.tsx` passed.
- The `GameModals` test covers the mounted `InvestmentBoard` host path and proves the caravan and loan buttons dispatch `INVEST_IN_CARAVAN` and `TAKE_LOAN`.
- The `DevMenu` test covers the direct launch path for the investment board and proves it dispatches `TOGGLE_INVESTMENT_BOARD` while closing the menu.
- `node scripts/audit-living-project-docs.cjs --project economy-ui` reports the project schema as valid with no missing required docs.
- The reducer ownership gap was closed as a docs-only contract: `uiReducer` owns `isTradeRouteDashboardVisible` and `isInvestmentBoardVisible`, while `economyReducer` owns `isEconomyLedgerVisible` and `isCourierPouchVisible`.

## Notes

- No visual regression screenshot was needed for this pass because the change was a modal-host wiring pass and the scoped tests exercised the live interaction path.
- No source migration was performed for the ownership decision; the code already matches the documented split.
