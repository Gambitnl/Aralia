# Worldsmith Task: Living Economy System

## Goal
Implement a dynamic economy where world events (e.g., droughts, surpluses) visibly impact market prices, making the world feel reactive and interconnected. Extend into a full living economy with business ownership, investments, faction economics, and in-world information delivery.

---

## Original Scope (Complete)

### 1. Refactor GameState
- [x] Add `economy` to `GameState` in `src/types/index.ts`.
- [x] Initialize `economy` in `src/state/initialState.ts` with default values.
- [x] Deprecate/Ignore `merchantModal.economy` (it was unused anyway).

### 2. Implement Economy Logic
- [x] Create `src/utils/economy/economyUtils.ts` to handle price calculations.
  - `calculatePrice(item, economy, transactionType, regionId)` with scarcity/surplus, MarketEvents, regional import/export modifiers, CP-precision rounding.
- [x] Write tests for `economyUtils.ts` (7 tests in `__tests__/economyUtils.test.ts`).

### 3. Update World Events
- [x] Update `src/systems/world/WorldEventManager.ts`.
  - `handleMarketShift` creates `MarketEvent` entries on `GameState.economy`.
  - Specific events: Bumper Harvest, War Shortage, Magic Surge, Trade Fair, Plague Outbreak, Bandit Activity.
  - Events expire via duration-based cleanup in `processWorldEvents`.

### 4. Connect UI
- [x] Update `src/components/Trade/MerchantModal.tsx`.
  - Uses `calculatePrice` from `economyUtils` for buy/sell prices.
  - Visual indicators: ▲ High Demand (red), ▼ Low Price (green) based on `isModified` + `multiplier`.

### 5. Verification
- [x] Unit tests for `economyUtils`.
- [x] Build passes.
- [x] UI shows modified prices during events.

### 6. Pre-commit
- [x] Tests pass.

---

## VISION.md Economy Systems Checklist

From `docs/VISION.md` Section 6: Economy & Trade:

- [x] Dynamic economy simulation — `economyUtils.ts`, MarketEvents, scarcity/surplus modifiers
- [x] Trade route mechanics — `TradeRouteManager.ts` + `TradeRouteSystem.ts` in `src/systems/economy/`
- [x] Resource availability per region — `REGIONAL_ECONOMIES` in `src/data/economy/regions.ts` with per-region imports/exports
- [ ] Business ownership — Stronghold types defined but no business simulation
- [ ] Investment/profit system — No caravan investment, loans, or speculation
- [ ] Smuggling mechanics — `SmugglingSystem.ts` exists but not wired to economy
- [ ] Guild membership/politics — `ThievesGuildSystem.ts` exists but no faction-wide economics
- [x] Price fluctuation events — `MarketEventType` (BOOM, BUST, SHORTAGE, SURPLUS, WAR_TAX, FESTIVAL) via WorldEventManager

### Beyond Original Plan (Already Built)
- [x] Regional import/export price modifiers in `calculatePrice()`
- [x] Trade route daily simulation (active/blockaded/booming state machine)
- [x] CP-precision rounding so cheap items don't collapse to 0 GP
- [x] MarketEvent generation from trade route status changes
- [x] Tavern gossip system with purchasable rumors (`RumorMill.tsx`)

---

## Expanded Roadmap — Phases 1–7

### Phase 1: Wire the Foundation
**Goal**: Fix orphaned `legacyReducer` (stronghold actions currently do nothing), connect `processDailyUpkeep` to daily loop, add stronghold management actions.

- [ ] Import `legacyReducer` in `src/state/appState.ts` pipeline
- [ ] Add stronghold daily processing to `ADVANCE_TIME` in `worldReducer.ts`
- [ ] Add `processAllStrongholds()` wrapper in `strongholdService.ts`
- [ ] Add `strongholdSummariesToMessages()` in `strongholdService.ts`
- [ ] Add actions: `RECRUIT_STAFF`, `FIRE_STAFF`, `PURCHASE_UPGRADE`, `START_STRONGHOLD_MISSION`
- [ ] Handle new actions in `legacyReducer.ts`
- [ ] Tests for stronghold processing and reducer

### Phase 2: Economy Reducer + Regional Wealth
**Goal**: Dedicated economy reducer. Activate `globalInflation` and `regionalWealth` for regional price differences.

- [ ] Create `src/state/reducers/economyReducer.ts`
- [ ] Create `src/systems/economy/RegionalEconomySystem.ts`
- [ ] Add `PlayerInvestment` type to `src/types/economy.ts`
- [ ] Add `playerInvestments` to GameState
- [ ] Add economy actions to `actionTypes.ts`
- [ ] Wire `globalInflation` + `regionalWealth` into `calculatePrice()`
- [ ] Tests for economy reducer and regional system

### Phase 3: Faction Economics
**Goal**: Treasury, taxes, trade control for all faction types.

- [ ] Create `src/systems/world/FactionEconomyManager.ts`
- [ ] Extend `Faction` type with treasury, taxRate, controlledRegions/Routes, economicPolicy
- [ ] Update faction data with initial economic values
- [ ] Wire into `processWorldEvents` daily loop
- [ ] Apply faction tax/bonus in `calculatePrice()`
- [ ] Tests for faction economics

### Phase 4: Business Ownership
**Goal**: Full business simulation extending strongholds — supply chains, customer satisfaction, competition.

- [ ] Create `src/types/business.ts` (BusinessType, BusinessMetrics, SupplyContract, BusinessState, BusinessDailyReport)
- [ ] Create `src/systems/economy/BusinessSimulation.ts`
- [ ] Create `src/data/economy/businessTemplates.ts`
- [ ] Add `businesses` to GameState
- [ ] Add business actions to `actionTypes.ts`
- [ ] Extend `UPGRADE_CATALOG` with business upgrades
- [ ] Wire into daily loop
- [ ] Tests for business simulation

### Phase 5: Finance System
**Goal**: Caravan investment, loans, trade speculation.

- [ ] Create `src/systems/economy/InvestmentManager.ts`
- [ ] Create `src/systems/economy/LoanSystem.ts`
- [ ] Add `LoanOffer` type
- [ ] Handle finance actions in `economyReducer.ts`
- [ ] Wire investment daily ticks into `ADVANCE_TIME`
- [ ] Tests for investment and loan systems

### Phase 6: Information Delivery (Medieval Trickle)
**Goal**: Courier-based delayed information. No instant data.

- [ ] Create `src/systems/economy/EconomicIntelSystem.ts`
- [ ] Add `PendingCourier` type
- [ ] Add `pendingCouriers` to GameState
- [ ] Process courier delivery in daily loop
- [ ] Extend `TavernGossipSystem` with market intelligence
- [ ] Tests for intel delay and courier system

### Phase 7: In-World UI
**Goal**: Enchanted ledger books, wax-sealed courier scrolls, tavern notice boards — no modern dashboards.

- [ ] Create `src/components/Economy/LedgerBook.tsx` (enchanted book with parchment)
- [ ] Create `src/components/Economy/CourierPouch.tsx` (sealed scrolls)
- [ ] Create `src/components/Economy/BusinessManagement.tsx` (quill ledger)
- [ ] Create `src/components/Economy/InvestmentBoard.tsx` (tavern notice board)
- [ ] Create `src/components/Economy/TradeMap.tsx` (ink-on-parchment routes)
- [ ] Add toggle actions and UI state
- [ ] Add "Trade Map" tab to MerchantModal
- [ ] Accessibility and component tests
