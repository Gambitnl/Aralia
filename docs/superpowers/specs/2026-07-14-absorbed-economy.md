# Absorbed project: economy (docs/projects/economy)

Absorbed into planmap topic `economy-player-surface` on 2026-07-15 (wave 10R).
The folder is deleted; git history is the archive. This doc keeps the
still-useful cold-start context for the economy engine.

## What the engine is

A live, partial gameplay system coupling world simulation, merchants,
factions, and UI. It models route viability/disruption/boom, regional wealth
and inflation drift, player and NPC business simulation, investments,
speculation, loans, market intel delivery (courier delays), and merchant
pricing. Treat it as a live system with multiple daily loops — never rewrite
it as a single isolated feature.

## Concrete file map

- Data and configuration: `src/data/tradeRoutes.ts`, `src/data/economy/regions.ts`,
  `src/data/economy/economyConfig.ts`, `src/data/economy/businessTemplates.ts`,
  `src/state/initialState.ts`
- Runtime and math: `src/systems/economy/TradeRouteSystem.ts`,
  `src/systems/economy/TradeRouteManager.ts`,
  `src/systems/economy/RegionalEconomySystem.ts`,
  `src/systems/economy/InvestmentManager.ts`, `src/systems/economy/LoanSystem.ts`,
  `src/systems/economy/EconomicIntelSystem.ts`
- Business sim: `src/systems/economy/BusinessSimulation.ts`,
  `src/systems/economy/NpcBusinessManager.ts`,
  `src/systems/economy/BusinessManagement.ts`,
  `src/systems/economy/BusinessAcquisition.ts`
- World and faction integration: `src/systems/world/WorldEventManager.ts`,
  `src/systems/world/FactionEconomyManager.ts`
- State and actions: `src/state/reducers/worldReducer.ts`,
  `src/state/reducers/economyReducer.ts`
- Pricing and events: `src/utils/economy/economyUtils.ts`,
  `src/utils/economy/marketEvents.ts`,
  `src/hooks/actions/handleMerchantInteraction.ts`
- UI: `src/components/Trade/TradeRouteDashboard.tsx`,
  `src/components/Trade/RouteCard.tsx`, `src/components/Trade/MarketEventCard.tsx`,
  `src/components/Trade/MerchantModal.tsx`,
  `src/components/Economy/InvestmentBoard.tsx`,
  `src/components/Economy/LedgerBook.tsx`, `src/components/Economy/CourierPouch.tsx`

## Known integration points (daily loop)

- `worldReducer` calls `processWorldEvents` on day tick, then runs business,
  business management, investment, and courier workflows for the same
  `daysPassed`.
- `WorldEventManager` drives route updates, then calls `processDailyRoutes`
  (TradeRouteManager), `updateRegionalWealth`, `updateGlobalInflation`,
  `processFactionDailyEconomics`, and `processDeliveries`
  (EconomicIntelSystem).
- `TradeRouteManager` writes events, then updates the economy projection
  (`marketEvents`, `activeEvents`, `marketFactors`) read by merchants and UI.
- `MerchantModal`, `handleMerchantInteraction.ts`, and `calculatePrice` share
  one pricing function.
- `worldBusinesses` actions in `economyReducer.ts` plus the business daily
  loops form one ownership chain for NPC and player businesses.

## Invariants and maintenance rules (proven, keep them true)

- `TradeRoute.status` includes `'booming'` as canonical; keep the status
  model aligned before adding future route states.
- Route-driven market events carry explicit good tags (`affectedTags`);
  `marketFactors` must stay derived via `calculateMarketFactors` so
  `marketEvents`, `activeEvents`, and `marketFactors` stay aligned.
- Keep the deterministic route-to-region integrity check
  (`src/systems/economy/__tests__/tradeRoutesData.test.ts`) as the acceptance
  gate; seed routes are validated against `REGIONAL_ECONOMIES`.
- When adding a new market-event source, refresh focused evidence for
  tag-to-factor and tag-to-pricing parity.

## Proof commands (G4/G5/G1 audit ledger, all pass 2026-06-08)

```
npm exec vitest run src/utils/economy/__tests__/economyUtils.test.ts
npm exec vitest run src/systems/economy/__tests__/TradeRouteManager.test.ts
npm exec vitest run src/systems/economy/__tests__/tradeRoutesData.test.ts
npm exec vitest run src/hooks/actions/__tests__/handleMerchantInteraction.test.ts src/components/Trade/__tests__/MerchantModal.test.tsx
```

Pass criteria: parsed item values support GP/SP/CP/PP with rounding that
prevents free buys; region/event multipliers apply to BUY/SELL; route
transitions (active/blockaded/booming) are deterministic; invalid transaction
payloads never dispatch; valid flows dispatch final-priced
`BUY_ITEM`/`SELL_ITEM`.
