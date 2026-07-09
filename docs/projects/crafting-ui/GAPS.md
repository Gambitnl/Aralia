---
schema_version: 1
gap_schema: project_gap_registry
project: Crafting UI
slug: crafting-ui
status: active
status_note: ""
registry_mode: canonical
last_updated: "2026-06-26"
gap_count: 8
open_gap_count: 6
resolved_gap_count: 2
routed_gap_count: 0
imported_gap_count: 0
decision_required_count: 0
visual_proof_required_count: 0
highest_severity: none
proof_freshness: recorded
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
north_star: docs/projects/crafting-ui/NORTH_STAR.md
tracker: docs/projects/crafting-ui/TRACKER.md
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
# Crafting UI Gap Registry

Status: active
Last updated: 2026-06-26

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

Current resume priority: G2+G5 as a single typing-and-proof slice. G4, G6, and G7 remain real follow-ups.

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G2 | resolved | in_scope_now | Qoder CLI | src/state/actionTypes.ts / src/state/reducers/craftingReducer.ts | T2 boundary scan | Tighten crafting action payload typing to typed quality/category unions | `UPDATE_CRAFTING_STATS` payload uses `quality: string` and `category: string` in `actionTypes.ts:311`. Reducer checks for `'ruined'`, `'masterwork'`, `'legendary'` string literals. Callers dispatch `'standard'` and `'ruined'` (AlchemyBenchPanel.tsx:152) and `result.quality` (line 190). Recipe categories are already typed as `'potion' \; board-reconciled 2026: task "PK-crafting-contract: Type UPDATE_CRAFTING_STATS payload, add missing TOGGLE_INVESTMENT_BOARD to .d.ts, add craftingReducer test" — src/state/actionTypes.ts (payload now CraftingQuality/CraftingCategory + new CraftingCategory export), src/state/actionTypes.d.ts (payload typed + TOGGLE_INVESTMENT_BOARD added + CraftingCategory), src/state/reducers/__tests__/craftingReducer.test.ts (NEW, 9 cases: ruined/standard/masterwork/legendary/nat20/category-count/accumulate/immutability/no-op). craftingReducer.ts+AlchemyBenchPanel.tsx unchanged: existing types already assignable. Self-reviewed; no tsc/vitest run per contract. | 'oil' \ | 'poison' \ | 'bomb' \ | 'utility' \ | 'ink'` in `alchemyRecipes.ts:28`. | Loose string payloads let typos pass silently. A `quality: 'msterwork'` typo would skip the masterwork counter with no compiler error. | Define `CraftingQuality = 'ruined' \ | 'standard' \ | 'masterwork' \ | 'legendary'` and `CraftingCategory = 'potion' \ | 'oil' \ | 'poison' \ | 'bomb' \ | 'utility' \ | 'ink'` in `types/crafting.ts`, update `actionTypes.ts` payload, and verify `npm run typecheck` passes. | `npm run typecheck` clean; reducer test named in G5 passes. |
| G3 | resolved | support_needed_now | Qoder CLI | src/components/Crafting/ExperimentPanel.tsx | T2 evidence scan | Resolve experimental damage handling contract | `ExperimentPanel.tsx:185-194` dispatches `MODIFY_PARTY_HEALTH` with negative amount and party member IDs. `characterReducer.ts:192` handles it. `ExperimentPanel.test.tsx:182-185` proves dispatch with `{ amount: -6, characterIds: ['party-lead', 'party-ally'] }`. | Damage was previously text-only; now routes through shared party-health reducer with test proof. | No further action needed. Gap is resolved in source and tests. | Verified: `MODIFY_PARTY_HEALTH` dispatch proven in source (ExperimentPanel.tsx:188-194) and test (ExperimentPanel.test.tsx:182-185). | Resolved by source evidence discovered during T2 boundary scan on 2026-06-17. |
| G4 | active | adjacent_follow_up | Worker | docs/projects/crafting/ | docs/projects/crafting-ui/NORTH_STAR.md update | Reconcile UI windowing pattern | Only Alchemy bench uses `WindowFrame`; gathering and creature harvest use custom overlays | Decide if window pattern should be standardized for UX consistency | Add a follow-up in systems UI review if this remains intentional |
| G5 | resolved | adjacent_follow_up | Qoder CLI | src/state/reducers/craftingReducer.ts | T2 boundary scan | Add reducer-contract proof for `UPDATE_CRAFTING_STATS` | No dedicated `craftingReducer.test.ts` file exists. Focused Crafting UI tests cover crafter adapter and panel selection paths, but the reducer's quality/category branching logic has no direct unit test.; board-reconciled 2026: task "PK-crafting-contract: Type UPDATE_CRAFTING_STATS payload, add missing TOGGLE_INVESTMENT_BOARD to .d.ts, add craftingReducer test" — src/state/actionTypes.ts (payload now CraftingQuality/CraftingCategory + new CraftingCategory export), src/state/actionTypes.d.ts (payload typed + TOGGLE_INVESTMENT_BOARD added + CraftingCategory), src/state/reducers/__tests__/craftingReducer.test.ts (NEW, 9 cases: ruined/standard/masterwork/legendary/nat20/category-count/accumulate/immutability/no-op). craftingReducer.ts+AlchemyBenchPanel.tsx unchanged: existing types already assignable. Self-reviewed; no tsc/vitest run per contract. | Reducer behavior for `UPDATE_CRAFTING_STATS` (quality checks, category counts, nat20 tracking) is unverified. Combined with G2 typing, this forms a single implementation slice. | Add `src/state/reducers/__tests__/craftingReducer.test.ts` covering `UPDATE_CRAFTING_STATS` branches: ruined, standard, masterwork, legendary, nat20, and category count increment. | Test file exists with all branches covered; `npm run test` passes. |
| G6 | active | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G13 | Code modularization audit routing | Alchemy bench is a large UI surface paired with a large recipe corpus. | `src/components/Crafting/AlchemyBenchPanel.tsx`; `src/systems/crafting/alchemyRecipes.ts`; `docs/projects/crafting/GAPS.md` G9 | UI extraction needs panel-flow proof and should not be mixed with recipe-corpus sharding. | Define UI-owned split boundaries and keep systems recipe ownership separate. | Alchemy bench UI proof and reducer/panel tests named before code movement |
| G7 | active | adjacent_follow_up | Qoder CLI | src/components/Crafting/AlchemyBenchPanel.tsx | T2 evidence scan | `UPDATE_CRAFTING_STATS` is only dispatched from `AlchemyBenchPanel.tsx` | Grep across `src/` found `UPDATE_CRAFTING_STATS` dispatch only in `AlchemyBenchPanel.tsx:150,188`. No other crafting panel (ExperimentPanel, GatheringPanel, CreatureHarvestPanel) dispatches stats updates. | If gathering, experiments, or creature harvest should contribute to crafting stats, the dispatch gap is invisible until a panel-flow audit catches it. | Decide whether non-alchemy crafting flows should also dispatch `UPDATE_CRAFTING_STATS` and record the decision. | Each crafting panel either dispatches stats or has an explicit "no stats" note in its header. |
| G8 | active | in_scope_now | Alchemist / Crafting UI owner | `src/components/CharacterSheet/Overview/InventoryList.tsx` | Retired `docs/tasks/ui-features/TASK_SALVAGE_UI.md` 2026-06-26 | Salvage recipes have backend support but no confirmed player-facing inventory entry point. | `src/systems/crafting/salvageSystem.ts`; `src/systems/crafting/data/recipes.ts` includes `recipeType: 'salvage'`; current inventory surface is `src/components/CharacterSheet/Overview/InventoryList.tsx`, replacing the stale flat `src/components/Inventory/InventoryList.tsx` path. | Salvage remains invisible to players if the UI does not expose eligible salvage recipes, confirmation, risk messaging, and result feedback. | Define the inventory action/menu target and add a bounded salvage confirmation flow that calls `attemptSalvage` for eligible items. | Component tests and rendered proof showing a salvage-eligible item exposes a Salvage action, displays inputs/outputs and loss risk, calls the salvage path, and reports success/failure. |

## Classification Guide

- `in_scope_now`: blocks reliable continuation if left unresolved.
- `support_needed_now`: required so implementation decisions are safe.
- `adjacent_follow_up`: real gap, but not needed to finish the current docs-only pass.

## Routing note

- This project stays focused on UI surface continuity and contract gaps.
- Cross-project ownership of core mechanics remains in `docs/projects/PROJECT_TRACKER.md` under `Crafting System`.
- If a gap is fully accepted by systems owners, import or route it there and keep this project's status aligned.

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
- If the current project should not own a gap, add or update the global gap tracker instead of keeping it here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.


## Schema Fit Notes

| Issue | Existing content shape | Why schema does not fit | Proposed schema change |
|---|---|---|---|
| Compact registry retained | Existing rows preserve the project's current compact gap notes, routing context, and proof wording. | A full canonical expansion would require a deeper row-by-row provenance pass than this schema-only migration. | Keep the compact table shape for now; expand only when each row can be normalized without guesswork. |
