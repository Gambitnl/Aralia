# Economy System North Star

Status: active
Last updated: 2026-06-08

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

- Completed slice: T3 route-region validation is resolved with seed routes now checked against `REGIONAL_ECONOMIES` in a deterministic test.
- Completed slice: T4 promoted `'booming'` into the shared trade-route status model and removed the matching runtime/UI casts.
- Completed slice: T2 exchange/rule audit checklist is now established for pricing inputs, route transitions, and merchant outcomes.
- Active safe lane: `G1` (economy event typing contracts) and `G5` representation-fidelity checks are now implemented.

## G4 Exchange/Rule Audit (complete)

Status: done (2026-06-08)

Scope:

- pricing inputs (`calculatePrice` + parse/rounding behavior),
- route transitions and market event outcomes (`processDailyRoutes` + event synthesis),
- merchant transaction outcomes (`validateMerchantTransaction`, transaction dispatch).

Durable pass criteria:

1. Pricing Inputs
   - Evidence:
     - `src/utils/economy/economyUtils.ts:62-83`, `130-295` (parse, market-events, regional modifiers, fallback handling).
     - `src/utils/economy/__tests__/economyUtils.test.ts:27-203` (cp/sp/pp parsing, rounding, region and market-event effects).
     - `src/components/Trade/MerchantModal.tsx:74-93`, `195-238` (price display path in BUY/SELL UI).
   - Pass criteria:
     - `calculatePrice` supports base-value parsing + rounding and does not return free buys.
     - Regional and market modifiers are deterministically exercised by tests.

2. Route Transitions and Outcomes
   - Evidence:
     - `src/systems/economy/TradeRouteManager.ts:33-223` (active/blockaded/booming transitions, market-event and factor updates).
     - `src/systems/economy/__tests__/TradeRouteManager.test.ts:51-155` (active->blockaded, blockaded->active, active->booming, booming->active; factor assertions).
     - `src/systems/economy/__tests__/tradeRoutesData.test.ts:1-17` (seed-route region lookup integrity).
   - Pass criteria:
     - Route transition behavior is locked by tests, with route-events and derived scarcity/surplus state staying aligned to transition outcomes.

3. Merchant Transaction Outcomes
   - Evidence:
     - `src/hooks/actions/handleMerchantInteraction.ts:68-91`, `251-405` (validation and buy/sell dispatch).
     - `src/hooks/actions/__tests__/handleMerchantInteraction.test.ts:1-70` (validation outcomes).
     - `src/components/Trade/__tests__/MerchantModal.test.tsx:93-123` (`BUY_ITEM` UI dispatch with calculated price).
   - Pass criteria:
     - Invalid buy/sell payloads do not dispatch state updates.
     - Valid transactions dispatch `BUY_ITEM` or `SELL_ITEM` with final rounded prices.

Execution evidence:

- Ledgered in `docs/projects/economy/AUDIT_OR_PROOF.md` with command checks:
  - `npm exec vitest run src/utils/economy/__tests__/economyUtils.test.ts src/systems/economy/__tests__/TradeRouteManager.test.ts src/hooks/actions/__tests__/handleMerchantInteraction.test.ts src/components/Trade/__tests__/MerchantModal.test.tsx`

## G5 Market Representation Fidelity (complete)

Status: done (2026-06-08)

Scope:

- `processDailyRoutes` now emits route events with explicit good tags (`affectedTags`) for shortage/surplus cases.
- `marketFactors` is derived from the shared `calculateMarketFactors` selector using those events.
- A test now verifies route event projection keeps `marketEvents`, `activeEvents`, and `marketFactors` aligned.

Evidence:

- `src/systems/economy/TradeRouteManager.ts`
- `src/systems/economy/__tests__/TradeRouteManager.test.ts`

Pass criteria:

- Route transitions remain deterministic and factor outputs remain in sync with generated event tags.
- `activeEvents` and `marketEvents` remain equivalent after each route projection update.

## Dashboard Card Schema

Project: Economy System
Slug: economy
Category: Feature/System Projects
Status: active
Confidence: high
Evidence: `docs/projects/economy`
Gap signal: 0 open gaps
Protocol: living project doc set
Next step: Keep active event contract parity in any new event source.
Required verification: scoped_tests, docs_consistency
Completed verification: scoped_tests, docs_consistency
Last proof: 2026-06-08
Workflow gaps reviewed: 2026-06-08

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

- `activeEvents` is now `MarketEvent[]`, aligned with `MarketEvent` and shared tag derivation helpers across route projection, market factor selectors, and pricing (`src/types/economy.ts`, `src/systems/world/WorldEventManager.ts`, `src/systems/economy/TradeRouteManager.ts`, `src/utils/economy/marketEvents.ts`, `src/utils/economy/economyUtils.ts`, `src/components/Trade/MerchantModal.tsx`).
- Route simulation now treats `'booming'` as a canonical `TradeRoute.status`, with regression coverage for active->booming and booming->active transitions.
- Market event tags in route-driven events are now sourced from explicit good tags on the route event payload, and `marketFactors` is derived through `calculateMarketFactors`.
- Project-level tracker row still calls for an exchange and rule audit for this domain (`docs/projects/PROJECT_TRACKER.md`).

## Next useful checks

- Keep `TradeRoute.status` aligned before adding any future route states, and confirm market event payload shapes before adding new gameplay effects.
- Keep the deterministic route-to-region integrity check in place as the acceptance gate (`src/systems/economy/__tests__/tradeRoutesData.test.ts`).
- Add or refresh focused evidence checks whenever a new market-event source is introduced, especially for tag-to-factor and tag-to-pricing parity.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first, then read the existing project gaps
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
