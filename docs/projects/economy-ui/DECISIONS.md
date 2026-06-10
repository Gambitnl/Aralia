# Economy UI Decisions

Status: active
Last updated: 2026-06-09

## Decision Log

- 2026-06-09 | Economy UI | `isInvestmentBoardVisible` lives in `uiReducer` with the other modal toggles because it is a visibility concern, while `INVEST_IN_CARAVAN` and `TAKE_LOAN` stay in `economyReducer` because they change economy state.
- 2026-06-09 | Economy UI | The Dev Menu opens `InvestmentBoard` with a direct close-and-open handler so the board becomes visible immediately instead of stacking behind the debug overlay.
- 2026-06-09 | Economy UI | The economy UI visibility split is intentional and documented: `uiReducer` owns `isTradeRouteDashboardVisible` and `isInvestmentBoardVisible`, while `economyReducer` owns `isEconomyLedgerVisible` and `isCourierPouchVisible`. No reducer migration is required for this pass.

## Open Follow-Up

- No open ownership-boundary follow-up remains for this pass. If a future normalization request appears, treat it as a separate reducer-migration review instead of a docs-only tweak.
