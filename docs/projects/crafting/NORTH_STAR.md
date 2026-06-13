---
schema_version: 1
project: Crafting System
slug: crafting
category: Gameplay Systems
main_category: "Game & Simulation"
subcategory: Core Sim Systems
status: active
last_updated: 2026-06-12
iteration: 6
confidence: high
evidence: docs/projects/crafting
gap_signal: "2 open gaps; G5 remains blocked and G6 waits on validation"
protocol: living project doc set
next_step: "Keep both craft engines separate; the G1 compatibility proof is closed, and any future migration work should start from a new evidence-backed gap. Keep G5 blocked until refining/enchanting placement is decided."
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
last_proof: 2026-06-09
workflow_gaps_reviewed: 2026-06-09
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Crafting System North Star

Status: active
Last updated: 2026-06-12

## Why this project exists
The crafting project is active in registry and has substantial existing implementation, but previous handoff notes were limited to scaffolding.  
This document preserves evidence-backed ownership so next agents can continue from a concrete state map and avoid rediscovering architecture intent.

## Current system state
The project currently contains both a legacy and an enhanced craft stack:

- `src/systems/crafting/craftingSystem.ts` is a callback-based legacy-style crafting core using `poor/standard/superior/masterwork` quality.
- `src/systems/crafting/craftingEngine.ts` is an enhanced core using `ruined/flawed/standard/masterwork/legendary`, location-aware roll modifiers, and progression-aware quality.
- `src/systems/crafting/batchCrafting.ts` adds batch size options and batch execution.
- `src/systems/crafting/crafterProgression.ts` and `src/systems/crafting/craftingAchievements.ts` provide progression/XP and achievement logic.
- `src/systems/crafting/craftingLocations.ts` defines location modifiers and allowed tools for recipes.
- `src/systems/crafting/ingredientGlossary.ts` builds a merged ingredient catalog from gathering, creature, and purchased sources.
- Domain systems exist for gathering and harvesting (`gatheringSystem.ts`, `gatheringData.ts`, `creatureHarvestSystem.ts`, `creatureHarvestData.ts`), experimental alchemy (`experimentalAlchemy.ts`), cooking (`CookingSystem.ts`), enchanting (`EnchantingSystem.ts`), refining (`RefiningSystem.ts`), and salvage (`salvageSystem.ts`).
- Recipe/data sets include `alchemyRecipes.ts`, `data/recipes.ts`, and `data/enchantingRecipes.ts`.
- `src/components/Crafting/ExperimentPanel.tsx` now counts reagent stack `quantity` when building the available ingredient pool, so stacked reagents can be selected up to their real quantity instead of being limited by inventory entry count, and it accepts additive drag-and-drop staging into the cauldron without removing the existing click path.
- G9 modularization split is now implemented by `src/components/Crafting/alchemyBenchSelectors.ts`; `src/components/Crafting/AlchemyBenchPanel.tsx` stays on tab routing, location/tool filters, research actions, and the recent-activity log while the helper owns the live recipe-browser derivations and keeps the quantity-aware batch preview outside the shell.

### Compatibility contract
The two core crafting implementations are intentionally not interchangeable yet:

- `src/systems/crafting/craftingSystem.ts` is the legacy callback-driven path. It checks materials by `itemId`, supports optional `qualityOutcomes`, and only speaks the legacy `poor/standard/superior/masterwork` quality vocabulary from `src/systems/crafting/types.ts`.
- `src/systems/crafting/craftingEngine.ts` is the enhanced path. It resolves craftability with ingredient, gold, tool, and known-recipe checks, then returns roll metadata, XP, time, gold, and the `ruined/flawed/standard/masterwork/legendary` quality vocabulary from `src/systems/crafting/crafterProgression.ts`.
- `src/systems/crafting/craftingCompatibility.ts` now makes the bridge explicit instead of implicit. It normalizes legacy results into an enhanced-facing payload for quality and side-effect fields, and it keeps the reverse quality map lossy only where the older vocabulary has no equivalent tier. Focused regression coverage now exercises explicit success/failure normalization, the full documented quality matrix in both directions, and the unavailable enhanced fields that remain intentionally absent from the legacy contract.

Compatibility matrix:

| Legacy quality | Enhanced quality |
|---|---|
| `poor` | `ruined` |
| `standard` | `standard` |
| `superior` | `masterwork` |
| `masterwork` | `legendary` |

| Enhanced quality | Legacy quality |
|---|---|
| `ruined` | `poor` |
| `flawed` | `standard` |
| `standard` | `standard` |
| `masterwork` | `superior` |
| `legendary` | `masterwork` |

Side-effect translation in the adapter:

- `consumedMaterials[]` becomes a boolean `materialsConsumed` flag.
- `experienceGained` becomes `xpGained`.
- `recipe.timeMinutes` becomes `timeSpentMinutes`.
- `goldSpent` stays `0` because the legacy path does not emit a gold cost.
- `roll`, `rawRoll`, `dc`, `qualityResult`, and `modifiersApplied` are not emitted by the legacy callback path, so the compatibility adapter now records provenance for those unmapped fields.

Preservation rules:

1. Keep both implementations in place until a dedicated adapter or migration slice exists.
2. Do not assume the two quality vocabularies are interchangeable. Any bridge must map outcomes explicitly and preserve which side consumes materials, gold, and time.
3. Do not delete, rename, or consolidate either file as a cleanup step while this contract is open.

Acceptance criteria:

1. `src/systems/crafting/__tests__/craftingSystem.test.ts` must continue to pass for the legacy path, including insufficient-material failure, default DC checks, custom `qualityOutcomes`, `itemIdOverride`, and `quantityMultiplier`.
2. `src/systems/crafting/craftingEngine.ts` must continue to preserve the enhanced craftability contract: ingredient/gold/tool/known gating in `checkRecipeCraftability`, and time/gold/material/XP output in `attemptCrafting`.
3. `src/systems/crafting/__tests__/craftingCompatibility.test.ts` proves adapter mapping for all documented quality pairs in both directions and for both successful and failed legacy-path normalization with stable side-effect fields, explicit provenance, and a stable unavailable-field list.

Blocker gate:

- Do not attempt any merge, split, or replacement of these two files until a mapping matrix exists for quality, material loss, time, gold, and XP semantics, and that matrix is backed by a regression proof. `G13` now tracks how legacy outcomes are traced and why certain enhanced fields are contractually unavailable from the legacy payload.

### UI and state integration
- UI panels are under `src/components/Crafting`:
  - `AlchemyBenchPanel.tsx`
  - `GatheringPanel.tsx`
  - `CreatureHarvestPanel.tsx`
  - `ExperimentPanel.tsx`
  - `IngredientGlossaryPanel.tsx`
- Character sheet entry is `src/components/CharacterSheet/Crafting/CraftingTab.tsx` with modal openings for gathering and alchemy.
- Combat integration for creature harvesting is in `src/components/Combat/CombatView.tsx` (`HARVESTABLE_CREATURES` -> `CreatureHarvestPanel`).
- State wiring is in:
  - `src/types/crafting.ts` (state shape, initial factory),
  - `src/types/state.ts` (`crafting?: CraftingState` optional),
  - `src/state/reducers/craftingReducer.ts` (INIT, learn, XP, stats, achievements),
  - `src/state/actionTypes.ts` (crafting action variants),
  - `src/state/appState.ts` (reducer is applied).
- Save/load uses generic `GameState` serialization in `src/services/saveLoadService.ts` and does not define a dedicated crafting migration branch.
- Initial game state in `src/state/initialState.ts` does not include `crafting`, so panel entry initializes state lazily.

## Known partials and uncertainty
1. **Engine duplication**
   - `craftingSystem.ts` and `craftingEngine.ts` overlap on core behavior with different contracts and quality models. The compatibility contract above now has a concrete adapter helper and broader regression proof for bidirectional quality mapping plus success/failure normalization, but the stack still needs to stay separate until any future consolidation is backed by more migration evidence.
2. **Input/model fidelity drift**
   - `craftingService.ts` now preserves exact-ID material checks and falls back to existing item type/category metadata for legacy recipes.
   - `craftingEngine.ts` includes fuzzy substring checks for tool names, which is useful but brittle.
3. **Crafting actor fallback**
   - `GatheringPanel.tsx` and `CreatureHarvestPanel.tsx` now resolve from live selected-character or party state through a shared adapter, but empty-party states still fall back to an explicit placeholder instead of a deeper selection contract.
4. **Experiment side effects now route through party HP**
   - `ExperimentPanel.tsx` now sends explosion fallout through `MODIFY_PARTY_HEALTH`, so the failure path is visible in the same party-health model the rest of the game already uses.
5. **Feature branch completeness**
   - `RefiningSystem.ts` and `EnchantingSystem.ts` still need a product/architecture decision on whether they own a dedicated panel, live inside an existing crafting tab, or remain system-only for now.
6. **Bench selector split**
   - `AlchemyBenchPanel.tsx` now delegates recipe-browser selection and batch preview assembly to `alchemyBenchSelectors.ts`, so the shell stays thin without moving the recipe corpus or the batch math.
7. **Persistence edge**
   - Save/load is version-aware but does not have explicit crafting-schema migration/backfill logic beyond generic state handling.
8. **Remaining alchemy follow-up**
   - `ExperimentPanel.tsx` now has an additive drag-and-drop staging path into the bench cauldron, so the missing interaction wiring is no longer the open issue.
   - `ingredientGlossary.ts` now exposes missing creature CR as `unknown` rarity instead of silently treating it as common.
9. **Compatibility provenance**
  - `craftingCompatibility.ts` now records explicit provenance (`source`, `outcomeSource`, `unavailableEnhancedFields`) so unmapped roll/DC/quality-result fields from the legacy path remain traceable for migration and diagnostics. The current proof pass extends that trace with explicit success/failure and full quality-mapping assertions.
## Dashboard Card Schema

Project: Crafting System
Slug: crafting
Category: Gameplay System
Status: active
Confidence: high
Evidence: docs/projects/crafting
Gap signal: G1 compatibility proof closed, G2 adapter proof closed, G3/G4/G8 resolved, G5 blocked on UX ownership, G7 drag-and-drop proof closed, G9 modularization split closed, G10 adapter proof expanded, G11 stacked-reagent accounting closed, G12 batch/craftability quantity proof closed, and G13 provenance follow-up completed 2026-06-09
Protocol: living project doc set
Next step: Preserve both craft engines; G1 compatibility proof is closed, and any future migration work should start from a new evidence-backed gap. Keep G5 blocked until refining/enchanting placement is decided.
Required verification: docs_consistency
Completed verification: focused craftingCompatibility tests; living-project schema audit with Crafting now schema_status valid; git diff --check
Last proof: 2026-06-09
Workflow gaps reviewed: 2026-06-09

## Evidence map (for handoff)
- Systems: `src/systems/crafting/craftingEngine.ts`, `craftingSystem.ts`, `batchCrafting.ts`, `craftingLocations.ts`, `craftingAchievements.ts`, `crafterProgression.ts`, `craftingService.ts`, `ingredientGlossary.ts`.
- UI: `src/components/Crafting/index.ts`, `AlchemyBenchPanel.tsx`, `alchemyBenchSelectors.ts`, `GatheringPanel.tsx`, `CreatureHarvestPanel.tsx`, `ExperimentPanel.tsx`, `IngredientGlossaryPanel.tsx`, `src/components/CharacterSheet/Crafting/CraftingTab.tsx`.
- State: `src/types/crafting.ts`, `src/types/state.ts`, `src/state/actionTypes.ts`, `src/state/reducers/craftingReducer.ts`, `src/state/appState.ts`, `src/services/saveLoadService.ts`, `src/state/initialState.ts`.
- Cross-feature evidence: `src/components/Combat/CombatView.tsx`, `src/systems/crafting/creatureHarvestData.ts`.

## Cross-boundary intent
The project should preserve both:
- Existing shipped behavior in UI and state actions.
- An explicit modernization track for the duplicate engine stack (legacy vs enhanced), avoiding accidental removal of either path before usage contracts are fully reconciled.

That modernization track is currently blocked on the compatibility contract above. Preserve both paths until the mapping gate is closed.

## Resume path for a cold start
1. Start here: `docs/projects/crafting/NORTH_STAR.md`.
2. Review owned work queue and task state: `docs/projects/crafting/TRACKER.md`.
3. Review concrete implementation gaps: `docs/projects/crafting/GAPS.md` (G1-G13).
4. Reconfirm global routing from `docs/projects/PROJECT_TRACKER.md`.
5. Reopen source hotspots in the evidence map above before making code changes.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
