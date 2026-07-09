---
schema_version: 1
gap_schema: project_gap_registry
project: Economy UI
slug: economy-ui
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-10"
gap_count: 5
open_gap_count: 5
resolved_gap_count: 0
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: medium
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/economy-ui/NORTH_STAR.md
tracker: docs/projects/economy-ui/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
allowed_statuses:
  - open
  - active
  - pending
  - blocked
  - not_started
  - in_progress
  - waiting
  - needs_validation
  - untriaged
  - routed
  - review-required
  - design_decision_deferred
  - merged-reference
  - resolved
  - closed
  - done
  - complete
  - out_of_scope
allowed_classifications:
  - in_scope_now
  - support_needed_now
  - adjacent_follow_up
  - out_of_scope
  - blocked_human_decision
  - blocked_external_state
  - uncertainty
  - architecture
  - workflow
  - execution-path
  - typing-safety
  - mechanics
  - ui
  - integration
  - data-model
  - test_coverage
  - schema_normalization
  - ownership
  - serialization
  - coverage
  - globalize
  - routed
  - design_decision_deferred
allowed_severities:
  - none
  - low
  - medium
  - high
  - critical
supported_optional_row_fields:
  - owner_confidence
  - source_project
  - imported_from
  - global_gap_id
  - linked_gap_id
  - routed_to
  - decision_required
  - decision_reference
  - review_required
  - visual_proof_required
  - proof_freshness
  - proof_date
  - uncertainty
  - notes
supported_optional_sections:
  - Current Readout
  - Current State
  - Purpose
  - Summary
  - Iteration Notes
  - Classification Notes
  - Global Routing
  - Global Gap Imports
  - Resolved Gap Log
  - Required Review Brief
  - Decision Visualizations
  - Open / Uncertain Notes
  - Appendix
---
project: Economy UI
slug: economy-ui
last_updated: \"2026-06-10\"
gap_count: 5
open_gap_count: 5
north_star: docs/projects/economy-ui/NORTH_STAR.md
tracker: docs/projects/economy-ui/TRACKER.md
global_gaps: docs/projects/GLOBAL_GAPS.md
highest_severity: medium
---
# Economy UI Gap Registry

Status: active
Last updated: 2026-06-10

Use this file for durable integration gaps that must be carried into implementation.

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.

## Iteration Notes

- 2026-06-05 | economy-ui workflow pass | Reviewed the current handoff against `GLOBAL_GAPS.md` and `WORKFLOW_GAPS.md`; no new project-specific blocker surfaced, so the existing G1-G3 set became the active gap surface for this iteration.
- 2026-06-09 | economy-ui modal wiring pass | Resolved G1 (Ledger/Courier not mounted) by adding modal hosts plus `TOGGLE_*` close dispatch in `GameModals.tsx` and by routing open actions through `App.tsx`/`DevMenu.tsx`.
- 2026-06-09 | economy-ui close-path parity pass | Extended modal-close regression coverage: fallback `Escape` now has explicit close proof for both `LedgerBook` and `CourierPouch` in `src/components/layout/__tests__/GameModals.test.tsx`.
- 2026-06-09 | economy-ui action-entry pass | Resolved G2 by mounting `InvestmentBoard` in `GameModals`, wiring caravan and loan callbacks to `INVEST_IN_CARAVAN` and `TAKE_LOAN`, and giving Dev Menu a direct close-and-open entry for the board.
- 2026-06-09 | economy-ui ownership contract pass | Resolved G3 by documenting the intentional reducer split instead of migrating visibility flags, so the board/route surfaces stay in `uiReducer` and the ledger/courier surfaces stay in `economyReducer`.
- 2026-06-10 | economy-ui normalization pass | Merged duplicate table structures from schema-normalization template append into single canonical tables. Opened G4 for missing player-facing entry points.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G4 | not_started | adjacent_follow_up | Economy UI docs owner | economy-ui | bounded gap sweep (2026-06-10) | No player-facing (non-dev-menu) entry points exist for `InvestmentBoard`, `LedgerBook`, or `CourierPouch`. All three surfaces are only reachable via DevMenu or debug keyboard shortcuts. | Source audit: `toggle_economy_ledger`, `toggle_courier_pouch`, `toggle_investment_board` dispatches occur only in `DevMenu.tsx` and `App.tsx` debug paths. No gameplay UI triggers these modals. | Economy features are functionally invisible to players during normal gameplay. When the economy simulation is mature, these surfaces need in-world triggers (e.g., town interaction, NPC merchant flow, or a dedicated economy tab). | Define in-world entry points when a product pass requests player-visible economy surfaces. Do not wire them prematurely. | At least one economy modal is reachable through a non-debug gameplay path. |
| G6 | resolved | in_scope_now | Economy UI docs owner | `src/components/layout/GameModals.tsx` | bounded gap sweep (2026-06-10) | `isTradeRouteDashboardVisible` is missing from the fallback Escape key handler chain in `GameModals.tsx` (L174-191). The dashboard renders and can be opened, but pressing Escape while it is the only open modal will not close it. | `src/components/layout/GameModals.tsx` L174-191 (escape chain), L773-782 (dashboard render).; board-reconciled 2026: task "PK-escape-key: Add isTradeRouteDashboardVisible to the fallback Escape-key handler chain in GameModals" — src/components/layout/GameModals.tsx; added 'if (gameState.isTradeRouteDashboardVisible) { dispatch({type:TOGGLE_TRADE_ROUTE_DASHBOARD}); return; }' to handleFallbackEscape (L236 area), grouped with InvestmentBoard/CourierPouch/EconomyLedger; matches existing pattern + verified render close action at L1037; deps array already covers gameState; self-reviewed, no tsc/build run per packet | Breaks the expected Escape-closes-modal UX that works for InvestmentBoard, LedgerBook, and CourierPouch. | Add `isTradeRouteDashboardVisible` to the Escape key handler and dispatch `TOGGLE_TRADE_ROUTE_DASHBOARD` on close. | Focused test: pressing Escape while TradeRouteDashboard is open dispatches the close action. |
| G7 | resolved | adjacent_follow_up | Economy UI docs owner | `src/state/actionTypes.d.ts` | bounded gap sweep (2026-06-10) | `TOGGLE_INVESTMENT_BOARD` is present in `actionTypes.ts` (L271) but missing from `actionTypes.d.ts`. The other three economy toggle types are present in both files. | `src/state/actionTypes.ts` L271 vs `src/state/actionTypes.d.ts` (searched, not found).; board-reconciled 2026: task "PK-crafting-contract: Type UPDATE_CRAFTING_STATS payload, add missing TOGGLE_INVESTMENT_BOARD to .d.ts, add craftingReducer test" — src/state/actionTypes.ts (payload now CraftingQuality/CraftingCategory + new CraftingCategory export), src/state/actionTypes.d.ts (payload typed + TOGGLE_INVESTMENT_BOARD added + CraftingCategory), src/state/reducers/__tests__/craftingReducer.test.ts (NEW, 9 cases: ruined/standard/masterwork/legendary/nat20/category-count/accumulate/immutability/no-op). craftingReducer.ts+AlchemyBenchPanel.tsx unchanged: existing types already assignable. Self-reviewed; no tsc/vitest run per contract. | Type declaration drift means external TypeScript consumers that read `.d.ts` files won't see the type, though runtime behavior is unaffected since the `.ts` source is the real contract. | Add `TOGGLE_INVESTMENT_BOARD` to `actionTypes.d.ts` alongside the other economy toggles. | `tsc --noEmit` passes and `actionTypes.d.ts` includes all four economy toggle types. |
| G8 | not_started | in_scope_now | Economy UI docs owner | economy-ui | transaction surface audit (2026-06-10) | Most existing transaction UIs bypass the economy framework entirely. Crafting (`AlchemyBenchPanel`), fencing (`FenceInterface`), org upgrades (`OrgUpgradesList`), quest rewards (`QuestCard`), and combat loot (`CombatView`) all handle gold with direct arithmetic instead of routing through `calculatePrice` / economy state. Business acquisition and NPC business management have backend systems but no UI. | `src/components/Crafting/AlchemyBenchPanel.tsx`, `src/components/Crime/ThievesGuild/FenceInterface.tsx`, `src/components/Organization/OrgUpgradesList.tsx`, `src/components/QuestLog/QuestCard.tsx`, `src/components/Combat/CombatView.tsx`, `src/systems/economy/BusinessAcquisition.ts`, `src/systems/economy/NpcBusinessManager.ts` | Without routing through the economy framework, market factors, faction standings, and regional pricing have no effect on most transactions. The economy simulation exists but is only felt through the merchant modal. Every bypass is a missed opportunity for the economy to feel alive and interconnected. | Define a standard transaction routing pattern (e.g., a shared `resolveTransactionCost` utility) and incrementally migrate existing surfaces to use it. Business acquisition and NPC business management need UI surfaces. | At least one currently-bypassing surface (e.g., crafting or fencing) routes costs through the economy framework instead of direct gold subtraction. |
| G9 | not_started | adjacent_follow_up | Economy UI docs owner | economy-ui | transaction surface audit (2026-06-10) | No transaction UI surfaces exist for major RPG domains where gold should logically move: mounts/horses, ships/vessels, mercenary/hireling hiring, housing/property, inn/tavern costs, temple/shrine services, training, guild fees, enchanting, gambling, tolls/taxes, bribery, bounties, spell material components, and naval voyage costs. Some of these have partial backend data (e.g., `voyageEvents.ts`, party companions, organization system) but no purchase/payment UI. | Codebase-wide search for transaction keywords confirmed no implementation. `src/data/naval/voyageEvents.ts` references costs; `src/data/companions.ts` and `src/components/Organization/` exist but lack hire/fee UIs. | These are core RPG money sinks and sources. Without them, the economy is disconnected from the majority of gameplay activities. The player has gold but limited ways to spend it beyond merchants. | As each game system matures (mounts, housing, etc.), this project should provide the UI integration pattern so new transaction surfaces connect to the economy framework from day one. Priority order should follow gameplay implementation roadmap. | Transaction UI surfaces exist for at least the highest-priority domains (mounts, housing, hirelings) when their game systems are built. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
