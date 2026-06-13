---
schema_version: 1
project: Crafting UI
slug: crafting-ui
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-09
iteration: 3
confidence: medium
evidence: docs/projects/crafting-ui
gap_signal: 5 open gaps (2 current blockers, 3 follow-ups)
protocol: living project doc set
next_step: Resume with G3 in GAPS.md and keep the UI/system contract boundary explicit.
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
  - docs_consistency
  - scoped_tests
completed_verification:
  - docs_consistency
  - scoped_tests
last_proof: 2026-06-09
workflow_gaps_reviewed: 2026-06-09
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Crafting UI North Star

Status: active
Last updated: 2026-06-09

## Dashboard Card Schema

Project: Crafting UI
Slug: crafting-ui
Category: Feature/UI Projects
Status: active
Confidence: medium
Evidence: docs/projects/crafting-ui
Gap signal: 5 open gaps (2 current blockers, 3 follow-ups)
Protocol: living project doc set
Next step: Resume with G3 in GAPS.md and keep the UI/system contract boundary explicit.
Required verification: docs_consistency, scoped_tests
Completed verification: docs_consistency, scoped_tests
Last proof: 2026-06-09
Workflow gaps reviewed: 2026-06-09

## Why this project exists

Preserve a practical handoff map for the crafting UI surfaces.
The feature is implemented, but current panel behavior and state coupling are not fully aligned with systems-level contracts.

## Purpose

Own the UI surfaces and entry points for:

- alchemy and recipe crafting
- experimental alchemy
- gathering
- creature part harvesting
- ingredient glossary

It does not own recipe math, location rules, or economy core calculations.

## Concrete file map

- `src/components/Crafting/index.ts` -- component exports
- `src/components/Crafting/AlchemyBenchPanel.tsx` -- main crafting window using `WindowFrame`
- `src/components/Crafting/GatheringPanel.tsx` -- gathering panel entry from character crafting tab
- `src/components/Crafting/CreatureHarvestPanel.tsx` -- creature harvest panel used after combat victory
- `src/components/Crafting/ExperimentPanel.tsx` -- experimental mixing flow
- `src/components/Crafting/IngredientGlossaryPanel.tsx` -- ingredient encyclopedia
- `src/components/Crafting/*.css` -- styles for each panel
- `src/components/Crafting/` CSS files are adjacent and co-owned with their panel components

## Current implemented state

- `CharacterSheet` routing:
  - `src/components/CharacterSheet/Crafting/CraftingTab.tsx` opens `GatheringPanel` and `AlchemyBenchPanel` in fixed overlays.
  - `src/components/CharacterSheet/CharacterSheetModal.tsx` includes the `Crafting` tab and renders `CraftingTab`.
- `AlchemyBenchPanel`:
  - Uses `WINDOW_KEYS.ALCHEMY_BENCH` and `WindowFrame`.
  - Supports tabs: recipes, experiment, glossary.
  - Uses `craftingEngine`, `batchCrafting`, `craftingLocations`, and `creature`/`alchemy` action dispatch.
  - Handles recipe lookup, recipe research costs, batch selection, and crafting result logs.
- `ExperimentPanel`:
  - Embedded in alchemy bench as nested tab.
  - Calls `attemptExperiment`, `combineProperties`, and updates progression via `learnRecipe`.
  - Consumes selected ingredient items from inventory with `REMOVE_ITEM`.
- `IngredientGlossaryPanel`:
  - Uses `buildIngredientGlossary`, `searchGlossary`, and filter helpers from `ingredientGlossary`.
  - Computes owned counts from `state.inventory`.
- `GatheringPanel`:
  - Calls `attemptIdentification` and `attemptHarvest`.
  - Resolves the acting crafter through `src/components/Crafting/crafterAdapter.ts`, preferring the selected character from the open sheet when one exists.
  - Adds harvested items via `ADD_ITEM`.
- `CreatureHarvestPanel`:
  - Triggered in `src/components/Combat/CombatView.tsx` only.
  - Resolves the acting crafter through the same shared adapter, anchored to the current party lead until CombatView exposes a separate selector.
  - Calls `attemptCreatureHarvest` and adds result items through `ADD_ITEM`.

## State and action integration

- `src/state/reducers/craftingReducer.ts` owns reducer paths for:
  - `INIT_CRAFTING_STATE`, `LEARN_RECIPE`, `ADD_CRAFTING_XP`, `UPDATE_CRAFTING_STATS`, `UNLOCK_ACHIEVEMENT`, `SET_CRAFTING_LOCATION`.
- `src/state/actionTypes.ts` currently types `UPDATE_CRAFTING_STATS` as `quality: string` and `category: string`.
- `src/state/appState.ts` includes `craftingReducer` in the default reducer pipeline.
- `src/types/crafting.ts` defines `CraftingState` defaults used by panels.

## Integration points

- UI integration:
  - `src/components/CharacterSheet/Crafting/CraftingTab.tsx`
  - `src/components/CharacterSheet/CharacterSheetModal.tsx`
  - `src/components/Combat/CombatView.tsx`
- System integration:
  - `src/systems/crafting/craftingEngine`
  - `src/systems/crafting/batchCrafting`
  - `src/systems/crafting/craftingLocations`
  - `src/systems/crafting/alchemyRecipes`
  - `src/systems/crafting/gatheringSystem`
  - `src/systems/crafting/gatheringData`
  - `src/systems/crafting/creatureHarvestSystem`
  - `src/systems/crafting/creatureHarvestData`
  - `src/systems/crafting/ingredientGlossary`
  - `src/systems/crafting/experimentalAlchemy`
  - `src/systems/crafting/alchemySystem`

## Active project-level gaps

- Current resume blockers are G2 and G3. G4, G5, and G6 stay as follow-up work unless the next slice re-opens them.
- UI and systems contract boundary is still split: registry now explicitly marks this project as needing reconciliation with systems/crafting.
- Some flows still rely on simplified placeholders:
  - Gathering now prefers the selected character from the open sheet; creature harvest stays on the party lead until CombatView exposes a separate selection prop.
  - Experiment result side effects include text-only damage logging instead of party damage dispatch.
  - Only AlchemyBenchPanel is wrapped in `WindowFrame`; Gathering and harvest use custom overlays.
- Focused craft UI tests now cover the shared crafter adapter plus the gathering and creature-harvest selection paths, but reducer-contract coverage still needs a named proof row.
- Action typing is not fully strict for crafting stat updates (`string` payload fields).

## Relationship to docs/projects/crafting

`docs/projects/PROJECT_TRACKER.md` already includes a Crafting UI row with evidence and explicit unresolved follow-up.
The systems project (`Crafting System` row) owns gameplay logic; this project owns UI surface reality and integration evidence.

## Active slice

| Field | Value |
|---|---|
| Task | Preserve the current Crafting UI contract map and the resolved G1 proof slice |
| Acceptance criteria | North Star, tracker, gaps, and proof docs agree on the shared crafter boundary, and the next agent can resume with G3 without re-deriving G1 |
| Allowed files | `docs/projects/crafting-ui/NORTH_STAR.md`, `docs/projects/crafting-ui/TRACKER.md`, `docs/projects/crafting-ui/GAPS.md`, `docs/projects/crafting-ui/COLD_START_AGENT_PROMPT.md`, `docs/projects/crafting-ui/AUDIT_OR_PROOF.md` |
| Stop condition | Docs reflect the G1 closure and the next safe resume path clearly enough for any engineer to continue from G3 |
| Verification | `docs_consistency`, focused Crafting UI vitest run, and manual file-map verification against `src/components/Crafting` and `src/components/CharacterSheet` and `src/components/Combat/CombatView.tsx` |

## Resume path

1. Read this file.
2. Read `docs/projects/crafting-ui/TRACKER.md` and `docs/projects/crafting-ui/GAPS.md`.
3. Start with G3 first, then G2 if the typing slice is still needed after the damage contract is settled.
4. Check `docs/projects/PROJECT_TRACKER.md` only if a gap needs routing back to `Crafting System`.
5. Keep scope narrow; if neither blocker is safe to address, preserve the docs state and record the reason instead of widening the slice.



## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
