---
schema_version: 1
project: Economy UI
slug: economy-ui
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-10
iteration: 6
confidence: medium
evidence: docs/projects/economy-ui
gap_signal: 5 open gaps (G4 player entry, G6 escape chain, G7 type drift, G8 economy bypass, G9 missing domains)
protocol: living project doc set
next_step: "Define in-world entry points for economy modals when a product pass requests player-visible economy surfaces."
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
last_proof: 2026-06-10
workflow_gaps_reviewed: 2026-06-10
compaction_status: needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Economy UI North Star

Status: active
Last updated: 2026-06-10

## Purpose and scope

This project is the **universal UI framework for any place gold changes hands**
in the game. It is not limited to trade routes or the four economy panels Ã¢â‚¬â€ it
covers the front-end surface for every transaction domain: buying, selling,
hiring, investing, paying fees, receiving rewards, and any future system where
currency moves between the player and the world.

The systems are currently **highly abstract and framework-level**, not heavily
graphically designed. The goal is to build the connective tissue that lets every
transaction surface (merchants, crafting costs, quest rewards, property
purchases, service fees, etc.) route through the economy framework so that
market factors, faction standings, and regional context can influence pricing
consistently.

In scope:
- Any UI surface where the player spends, earns, or manages gold.
- The framework to connect transaction UIs to the economy state/reducer system.
- Modal visibility and dispatch wiring for player access to economy panels.
- Ensuring new transaction domains (mounts, ships, housing, hirelings, services)
  have a clear UI integration path when their systems are built.
- Cross-project relationship to the economy simulation system.

Out of scope:
- Economy simulation math, route updates, and pricing model changes (owned by
  `docs/projects/economy`).
- Business rule changes outside user-visible economy UI.
- Building the game systems themselves (e.g., the mount system, the housing
  system) Ã¢â‚¬â€ this project owns how their transaction UIs connect to economy state.

## Current state

- Active slice: T5 (tracker/gap normalization) is complete. All prior task slices T1-T4 remain done.
- Secondary open slice: none. G4 (missing player-facing entry points) is the only open project gap but is classified as adjacent_follow_up, not blocking.
- Resume path: preserve the modal hosting model from T2 and the documented reducer split; only reopen if a future reducer migration is requested.

## Dashboard Card Schema

Project: Economy UI
Slug: economy-ui
Category: Feature/UI Projects
Status: active
Confidence: medium
Evidence: `docs/projects/economy-ui`
Gap signal: 5 open gaps (G4 player entry, G6 escape chain, G7 type drift, G8 economy bypass, G9 missing domains)
Protocol: living project doc set
Next step: Define in-world entry points for economy modals when a product pass requests player-visible economy surfaces.
Required verification: scoped_tests, docs_consistency
Completed verification: scoped_tests, docs_consistency
Last proof: 2026-06-10
Workflow gaps reviewed: 2026-06-10

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

## Transaction surface inventory

This is the landscape of every place gold moves in the game, whether or not it
currently routes through the economy system. The core gap is that most existing
transaction UIs bypass the economy framework entirely Ã¢â‚¬â€ they do direct
`gold - cost` without connecting to market factors, regional pricing, or faction
modifiers.

### Connected to economy state (routes through economyReducer / economyUtils)

| Surface | UI component | Entry point | Notes |
|---|---|---|---|
| Merchant buy/sell | `MerchantModal` | Town NPC interaction | Uses `calculatePrice` with market factors |
| Investments (caravans) | `InvestmentBoard` | DevMenu only | Dispatches `INVEST_IN_CARAVAN` |
| Loans | `InvestmentBoard` | DevMenu only | Dispatches `TAKE_LOAN` |
| Trade route monitoring | `TradeRouteDashboard` | DevMenu only | Read-only display |
| Player finance overview | `LedgerBook` | DevMenu only | Treasury, investments, businesses, debts |
| Market intel | `CourierPouch` | DevMenu only | Courier messages |

### Handles gold independently (bypasses economy framework)

| Surface | UI component | How gold moves | Gap |
|---|---|---|---|
| Crafting (alchemy) | `AlchemyBenchPanel` | Direct gold check, no economy pricing | Should route through `calculatePrice` for ingredient costs |
| Fencing stolen goods | `FenceInterface` | Independent fence value calc | Should factor faction/regional modifiers |
| Organization upgrades | `OrgUpgradesList` | Direct gold deduction | Should route through economy for upgrade costs |
| Quest rewards | `QuestCard` | Direct gold addition | Could factor regional economic state |
| Combat loot | `CombatView` | Direct gold pickup | Could factor regional loot tables |
| Business acquisition | Backend system only | `BusinessAcquisition.ts` | No UI surface exists |
| NPC business management | Backend system only | `NpcBusinessManager.ts` | No UI surface exists |

### No implementation yet (future transaction domains)

| Domain | What it covers | Priority signal |
|---|---|---|
| Mounts / horses | Buying, stabling, feeding, equipment | Core RPG expectation |
| Ships / vessels | Purchase, crew wages, repairs, docking fees | Naval system exists in data |
| Mercenary / hireling hiring | Wages, contracts, equipment provision | Party system exists |
| Housing / property | Purchase, rent, furnishing, upkeep | Town interaction surface |
| Inn / tavern | Room and board, food, drink | Town interaction surface |
| Temple / shrine services | Resurrection, healing, blessings | Service fee pattern |
| Training costs | Level-up fees, skill training, language tutoring | Character progression |
| Guild fees / dues | Membership, rank advancement, services | Organization system exists |
| Enchanting costs | Item enhancement, magical services | Crafting system adjacent |
| Gambling | Games of chance, betting | Tavern interaction |
| Tolls / taxes / tariffs | Road tolls, city entry, trade tariffs | Travel and economy |
| Bribery / persuasion | Guard bribery, NPC persuasion costs | Social interaction |
| Bounty system | Bounty posting, collection, wanted status | Quest system adjacent |
| Spell material components | Costly components (e.g., 300gp diamonds for Revivify) | Spellcasting system |
| Naval voyage costs | Crew pay, provisions, port fees | `voyageEvents.ts` has data |

## Relation to docs/projects/economy

This project is the front-end surface for the economy system described in
`docs/projects/economy/*.md`.
That project owns simulation, route math, market events, loans, and business progression.
This project owns where and how that state is surfaced to the player.

## Gaps to resolve next

- G4: No player-facing (non-dev-menu) entry points exist for `InvestmentBoard`,
  `LedgerBook`, or `CourierPouch`.
- G6: `isTradeRouteDashboardVisible` missing from the Escape key handler chain.
- G7: `TOGGLE_INVESTMENT_BOARD` missing from `actionTypes.d.ts`.
- G8: Most existing transaction UIs (crafting, fencing, org upgrades, quest
  rewards, combat loot) bypass the economy framework entirely Ã¢â‚¬â€ direct gold
  math with no connection to market factors or regional pricing.
- G9: No transaction UI surfaces exist for major RPG domains: mounts, ships,
  hirelings, housing, inns, temple services, training, guild fees, enchanting,
  gambling, tolls, bounties, or spell component costs.
- No open project gap remains for reducer ownership.

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
