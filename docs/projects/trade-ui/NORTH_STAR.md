---
schema_version: 1
project: Trade Ui
slug: trade-ui
category: active project
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-05
confidence: unknown
evidence: "docs/projects/trade-ui/TRACKER.md; docs/projects/trade-ui/GAPS.md"
gap_signal: present
protocol: living-project
next_step: Resume from TRACKER.md and keep the gap log aligned.
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
required_verification:
  - docs consistency
completed_verification:
  - docs refresh
last_proof: 2026-06-05
workflow_gaps_reviewed: ""
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Trade UI North Star

Status: active
Last updated: 2026-06-05

## Dashboard Card Schema

| Field | Value |
|---|---|
| Project | Trade Ui |
| Slug | trade-ui |
| Category | active project |
| Status | active |
| Confidence | unknown |
| Evidence | docs/projects/trade-ui/TRACKER.md; docs/projects/trade-ui/GAPS.md |
| Gap signal | present |
| Protocol | living-project |
| Next step | Resume from TRACKER.md and keep the gap log aligned. |
| Required verification | docs consistency |
| Completed verification | docs refresh |
| Last proof | 2026-06-05 docs refresh |
| Workflow gaps reviewed | yes |

## Why This Project Exists

Preserve Trade UI intent and continuity across handoffs.
Trade is already partially implemented, and this project keeps the live surface
understood before feature expansion.

## Intended Outcome

Create a cold-start map of trade UI implementation, current integration points,
and unresolved gaps without changing runtime behavior.

## Scope and Boundaries

In scope:
- Merchant modal flow (buy, sell, pricing, tavern rumor tab).
- Trade route dashboard visibility and display tabs.
- Action and reducer wiring that connects merchant UI to game state.

Adjacent but not in scope:
- Economy math and simulation internals.
- Investment/ledger/courier economy UI systems outside `src/components/Trade`.
- New merchant features that require gameplay design decisions (barter, offers, etc.).

Out of scope:
- Editing outside `docs/projects/trade-ui`.
- Runtime refactors unrelated to trade surface ownership.

## File Map

- `src/components/Trade/MerchantModal.tsx`
  - Main merchant UI with buy/sell columns and `calculatePrice` usage.
- `src/components/Trade/TradeRouteDashboard.tsx`
  - Route monitor modal showing overview, route list, and events list.
- `src/components/Trade/RouteCard.tsx`
  - Per-route display for status, profitability, and risk.
- `src/components/Trade/MarketEventCard.tsx`
  - Per-event display card for market events.
- `src/components/Trade/__tests__/MerchantModal.test.tsx`
  - UI coverage for modal open, close, and buy/sell behavior.
- `src/components/layout/GameModals.tsx`
  - Mount point for `MerchantModal` and `TradeRouteDashboard`.
- `src/hooks/actions/handleMerchantInteraction.ts`
  - Open flow and buy/sell/haggle execution handling.
- `src/state/reducers/uiReducer.ts`
  - `OPEN_MERCHANT`, `CLOSE_MERCHANT`, `TOGGLE_TRADE_ROUTE_DASHBOARD`.
- `src/state/reducers/characterReducer.ts`
  - Gold/inventory updates for `BUY_ITEM` and `SELL_ITEM`.
- `src/utils/economy/economyUtils.ts`
  - Central pricing with market events, region, faction, and scarcity logic.
- `src/types/state.ts`, `src/types/economy.ts`, `src/types/actions.ts`
  - Action contracts and game state types used by trade flow.

## Implemented State

- Merchant modal is wired through `GameModals` and opens via `OPEN_MERCHANT`.
- Player can buy and sell items from the modal; both columns disable impossible
  actions and show region-aware prices.
- Dynamic merchant inventory can be opened from action handlers via
  `handleOpenDynamicMerchant`.
- Trade route dashboard can be toggled and renders trade route and event counts.
- Haggling logic exists in action handling (`HAGGLE_ITEM` path), but the current
  merchant modal has no direct haggling control; it exposes only trade and tavern
  tabs.

## Integrations

- `handleOpenDynamicMerchant` generates inventory, builds optional economy snapshots,
  and dispatches `OPEN_MERCHANT`.
- `handleMerchantAction` validates and dispatches `BUY_ITEM`/`SELL_ITEM` and applies
  haggling multipliers where present.
- `uiReducer` owns modal visibility state and closes conflicting UIs when open.
- `characterReducer` applies transactional state transitions for gold and inventory.
- `calculatePrice` is shared across `MerchantModal` and merchant actions, and feeds
  both display pricing and final execution cost/value.

## Relation to Economy and Economy-UI

- This project is the front-end exchange surface for the economy system.
- It overlaps with `docs/projects/economy-ui` and should not duplicate
  economy simulation ownership.
- Route and pricing data (`tradeRoutes`, `marketEvents`, `marketFactors`, `globalInflation`)
  are read from economy state but displayed here.

## Known Gaps and Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| Normalize pricing and offer format | adjacent_follow_up | worker | `docs/projects/PROJECT_TRACKER.md` | Carry explicit offer/price payload rules into next trade feature pass |
| Migrate away from `activeEvents` legacy path | adjacent_follow_up | worker | `src/components/Trade/MerchantModal.tsx`, `src/types/economy.ts` | Confirm migration to `marketEvents` plus typed shape |
| Route status and event tags show UI assumptions not aligned with strict types | adjacent_follow_up | worker | `src/components/Trade/TradeRouteDashboard.tsx`, `src/types/economy.ts` | Decide if route status union and event tags are in-scope for economy/types |
| HAGGLE action is unsupported in merchant modal controls | support_needed_now | worker | `src/hooks/actions/handleMerchantInteraction.ts`, `src/components/Trade/MerchantModal.tsx` | Add or confirm intentional omission before trade balance pass |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/trade-ui/TRACKER.md`.
3. Read `docs/projects/trade-ui/GAPS.md`.
4. Continue from the next action and verify integration files in `src/components/Trade`.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
