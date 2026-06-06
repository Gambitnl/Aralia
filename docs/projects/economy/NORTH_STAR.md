# Economy System North Star

Status: active
Last updated: 2026-06-05

## Purpose and scope

Economy is a partial but active gameplay system. It models:
- route viability, disruption, and boom effects,
- regional wealth and inflation drift,
- player and NPC business simulation,
- investments, speculation, and loans,
- market intel delivery flow,
- merchant pricing.

This project is a coupling layer between world simulation, merchants, factions, and UI. A future agent should treat this as a live system with multiple daily loops and avoid rewriting it as a single isolated feature.

## Current state

- Active slice: T3 verifies route-region id validity for seed routes before any broader economy tuning work.
- Secondary open slice: T4 keeps the `'booming'` route-status union question visible, but it is not the next resume action.
- Resume path: validate every seed route against `REGIONAL_ECONOMIES`, repair invalid mappings in `src/data/tradeRoutes.ts`, and keep a CI-safe assertion or test around the catalog.

## Dashboard Card Schema

Project: Economy System
Slug: economy
Category: Feature/System Projects
Status: active
Confidence: high
Evidence: `docs/projects/economy`
Gap signal: 5 open gaps
Protocol: living project doc set
Next step: Resume T3 by validating and repairing seed route IDs against `REGIONAL_ECONOMIES`.
Required verification: scoped_tests, docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## What is implemented today

- Route simulation and scoring in `src/systems/economy/TradeRouteSystem.ts` and `src/systems/economy/TradeRouteManager.ts`.
- Regional economics in `src/systems/economy/RegionalEconomySystem.ts`.
- Business simulation and management in `src/systems/economy/BusinessSimulation.ts`, `src/systems/economy/NpcBusinessManager.ts`, `src/systems/economy/BusinessManagement.ts`, and `src/systems/economy/BusinessAcquisition.ts`.
- Investments/loans/speculation daily progression in `src/systems/economy/InvestmentManager.ts` and `src/systems/economy/LoanSystem.ts`.
- Market intel and courier delays in `src/systems/economy/EconomicIntelSystem.ts`.
- Faction daily financial effects in `src/systems/world/FactionEconomyManager.ts`.
- Shared pricing path in `src/utils/economy/economyUtils.ts`.
- Economy action reducer in `src/state/reducers/economyReducer.ts`.
- Daily world integration in `src/state/reducers/worldReducer.ts`.
- UI surfaces in `src/components/Trade/*`, `src/components/Economy/*`.
- Route and pricing tests in `src/systems/economy/__tests__/*`, `src/utils/economy/__tests__/economyUtils.test.ts`, `src/components/Trade/__tests__/MerchantModal.test.tsx`.

## Concrete file map

- Data and configuration:
  - `src/data/tradeRoutes.ts`
  - `src/data/economy/regions.ts`
  - `src/data/economy/economyConfig.ts`
  - `src/data/economy/businessTemplates.ts`
  - `src/state/initialState.ts`
- Runtime and math:
  - `src/systems/economy/TradeRouteSystem.ts`
  - `src/systems/economy/TradeRouteManager.ts`
  - `src/systems/economy/RegionalEconomySystem.ts`
  - `src/systems/economy/InvestmentManager.ts`
  - `src/systems/economy/LoanSystem.ts`
  - `src/systems/economy/EconomicIntelSystem.ts`
- World and faction integration:
  - `src/systems/world/WorldEventManager.ts`
  - `src/systems/world/FactionEconomyManager.ts`
- State and actions:
  - `src/state/reducers/worldReducer.ts`
  - `src/state/reducers/economyReducer.ts`
- Pricing and events:
  - `src/utils/economy/economyUtils.ts`
  - `src/utils/economy/marketEvents.ts`
  - `src/hooks/actions/handleMerchantInteraction.ts`
- UI:
  - `src/components/Trade/TradeRouteDashboard.tsx`
  - `src/components/Trade/RouteCard.tsx`
  - `src/components/Trade/MarketEventCard.tsx`
  - `src/components/Trade/MerchantModal.tsx`
  - `src/components/Economy/InvestmentBoard.tsx`
  - `src/components/Economy/LedgerBook.tsx`
  - `src/components/Economy/CourierPouch.tsx`

## Known integration points

- `worldReducer` calls `processWorldEvents` on day tick, then runs business, business management, investment, and courier workflows for the same `daysPassed`.
- `WorldEventManager` in turn drives route updates and then calls:
  - `processDailyRoutes` (`src/systems/economy/TradeRouteManager.ts`)
  - `updateRegionalWealth` and `updateGlobalInflation`
  - `processFactionDailyEconomics`
  - `processDeliveries` (`src/systems/economy/EconomicIntelSystem.ts`)
- `TradeRouteManager` writes events and then updates economy projection (`marketEvents`, `activeEvents`, `marketFactors`), which are read by merchants and UI.
- `MerchantModal`, `handleMerchantInteraction.ts`, and `calculatePrice` share the same pricing function.
- `worldBusinesses` actions in `economyReducer.ts` and business daily loops in world/system files form one ownership chain for NPC and player businesses.

## Missing or uncertain items (evidence-backed)

- `activeEvents` is still `unknown[]` in `EconomyState`, while route data is pushed into it and read in UI (`src/types/economy.ts`, `src/systems/world/WorldEventManager.ts`, `src/components/Trade/MerchantModal.tsx`).
- Route simulation uses `'booming'` as an effective status but the `TradeRoute` type excludes it (`src/systems/economy/TradeRouteManager.ts`, `src/types/economy.ts`).
- Initial route data includes `region_plains`, `region_desert`, `region_farmlands` which are not defined in `REGIONAL_ECONOMIES` (`src/data/tradeRoutes.ts`, `src/data/economy/regions.ts`).
- Market event tags are carried partly by heuristic extraction from names/strings in both route and pricing code (`src/systems/economy/TradeRouteManager.ts`, `src/utils/economy/economyUtils.ts`, `src/utils/economy/marketEvents.ts`).
- Project-level tracker row still calls for an exchange and rule audit for this domain (`docs/projects/PROJECT_TRACKER.md`).

## Next useful checks

- Confirm type alignment for `TradeRoute.status` and all market event payload shapes before adding new gameplay effects.
- Add an explicit route-to-region integrity check (origin and destination must exist in `REGIONAL_ECONOMIES`) and use it as the acceptance gate for T3.
- Create a compact exchange/rule audit section for pricing inputs, route transitions, and merchant transaction outcomes with evidence proof files for future acceptance checks.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first, then read the existing project gaps
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
