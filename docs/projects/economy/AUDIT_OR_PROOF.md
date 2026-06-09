# Economy Exchange/Rule Audit and Proof

Last updated: 2026-06-08
Status: done

## Scope

This ledger captures the completed G4 slice for:

- pricing inputs and price modifiers,
- route transition rules and route-driven market outcomes,
- merchant transaction outcomes.

## Checks and Evidence

| Check ID | Area | Evidence | Command | Pass criteria | Result |
|---|---|---|---|---|---|
| G4-P1 | Pricing inputs | `src/utils/economy/economyUtils.ts:62-83`, `src/utils/economy/economyUtils.ts:130-295`, `src/components/Trade/MerchantModal.tsx:74-238` | `npm exec vitest run src/utils/economy/__tests__/economyUtils.test.ts` | Parsed item values support GP/SP/CP/PP, rounding prevents free buys, and region/event multipliers are applied for BUY/SELL. | pass |
| G4-P2 | Route transitions | `src/systems/economy/TradeRouteManager.ts:33-223`, `src/systems/economy/__tests__/TradeRouteManager.test.ts:51-155`, `src/systems/economy/__tests__/tradeRoutesData.test.ts:1-17` | `npm exec vitest run src/systems/economy/__tests__/TradeRouteManager.test.ts` and `npm exec vitest run src/systems/economy/__tests__/tradeRoutesData.test.ts` | Active/blockaded/booming transitions and route-driven market event/factor updates are deterministic and covered by assertions. | pass |
| G4-P3 | Merchant outcomes | `src/hooks/actions/handleMerchantInteraction.ts:68-91`, `src/hooks/actions/handleMerchantInteraction.ts:251-405`, `src/hooks/actions/__tests__/handleMerchantInteraction.test.ts:1-70`, `src/components/Trade/__tests__/MerchantModal.test.tsx:93-123` | `npm exec vitest run src/hooks/actions/__tests__/handleMerchantInteraction.test.ts src/components/Trade/__tests__/MerchantModal.test.tsx` | Invalid transaction payloads are rejected; valid buy/sell flows dispatch final-priced `BUY_ITEM`/`SELL_ITEM` outcomes. | pass |
| G5-P1 | Market representation fidelity | `src/systems/economy/TradeRouteManager.ts:1-240`, `src/systems/economy/__tests__/TradeRouteManager.test.ts:1-210` | `npm exec vitest run src/systems/economy/__tests__/TradeRouteManager.test.ts` | `marketEvents`, `activeEvents`, and `marketFactors` remain aligned when route events are regenerated; factors are derived via shared selector logic. | pass |
| G1-P1 | Event typing contract + tag consumption | `src/types/economy.ts`, `src/systems/economy/TradeRouteManager.ts`, `src/utils/economy/marketEvents.ts`, `src/utils/economy/__tests__/economyUtils.test.ts`, `src/systems/economy/__tests__/TradeRouteManager.test.ts` | `npm exec vitest run src/systems/economy/__tests__/TradeRouteManager.test.ts src/utils/economy/__tests__/economyUtils.test.ts` | Route-driven event tags are emitted as `affectedTags`, route market factors are derived from shared helpers, and pricing consumes typed tags without relying solely on name parsing. | pass |

## Notes

- G4 lane is fully documented and no blocker is open in this slice.
- G5 lane is now documented with `G5-P1` and confirms that route-driven market event tags/factors can be proven aligned.
