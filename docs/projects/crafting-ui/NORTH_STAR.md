---
schema_version: 1
project: Crafting UI
slug: crafting-ui
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-17
iteration: 4
confidence: medium
evidence: docs/projects/crafting-ui
gap_signal: 5 open gaps; G2 typing, G5 reducer proof, G4 windowing, G6 modularization, G7 stats dispatch
protocol: living project doc set
next_step: Implement G2+G5 as a single slice: tighten UPDATE_CRAFTING_STATS payload typing and add craftingReducer.test.ts.
agent_comments: ""
active_agent: "Qoder CLI"
agent_pass_status: finished
agent_pass_started_at: "2026-06-17T18:30:00+02:00"
agent_pass_ended_at: "2026-06-17T19:00:00+02:00"
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
last_proof: 2026-06-17
workflow_gaps_reviewed: 2026-06-17
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Crafting UI North Star

Status: active
Last updated: 2026-06-17

## Dashboard Card Schema

Project: Crafting UI
Slug: crafting-ui
Category: Feature/UI Projects
Status: active
Confidence: medium
Evidence: docs/projects/crafting-ui
Gap signal: 5 open gaps; G2 typing, G5 reducer proof, G4 windowing, G6 modularization, G7 stats dispatch
Protocol: living project doc set
Next step: Implement G2+G5 as a single slice: tighten UPDATE_CRAFTING_STATS payload typing and add craftingReducer.test.ts.
Required verification: docs_consistency, scoped_tests
Completed verification: docs_consistency
Last proof: 2026-06-17
Workflow gaps reviewed: 2026-06-17

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

- G2 (typing) and G5 (reducer proof) are the next implementation slice — they are tightly coupled and should be taken together.
- G3 is resolved: experiment damage dispatches `MODIFY_PARTY_HEALTH` through the shared party-health reducer with test proof.
- G4 (windowing), G6 (modularization), and G7 (stats dispatch coverage) remain follow-up work.
- UI and systems contract boundary is mostly settled: crafter adapter (G1) and experiment damage (G3) are resolved. The remaining boundary is action typing (G2).
- Action typing is not fully strict for crafting stat updates (`string` payload fields for `quality` and `category`).
- `UPDATE_CRAFTING_STATS` is only dispatched from AlchemyBenchPanel — other crafting panels do not report stats (G7).

## Relationship to docs/projects/crafting

`docs/projects/PROJECT_TRACKER.md` already includes a Crafting UI row with evidence and explicit unresolved follow-up.
The systems project (`Crafting System` row) owns gameplay logic; this project owns UI surface reality and integration evidence.

## Active slice

| Field | Value |
|---|---|
| Task | Implement G2+G5: tighten `UPDATE_CRAFTING_STATS` payload typing and add `craftingReducer.test.ts` |
| Acceptance criteria | `CraftingQuality` and `CraftingCategory` type unions defined in `types/crafting.ts`; `actionTypes.ts` payload updated; `craftingReducer.test.ts` covers ruined/standard/masterwork/legendary/nat20/category-count branches; `npm run typecheck` and `npm run test` pass |
| Allowed files | `src/types/crafting.ts`, `src/state/actionTypes.ts`, `src/state/reducers/craftingReducer.ts`, `src/state/reducers/__tests__/craftingReducer.test.ts`, `src/components/Crafting/AlchemyBenchPanel.tsx` |
| Stop condition | Do not widen into G4 (windowing), G6 (modularization), or G7 (stats dispatch coverage) unless a typing change forces it |
| Verification | `npm run typecheck`, `npm run test -- --run src/state/reducers/__tests__/craftingReducer.test.ts` |

## Resume path

1. Read this file.
2. Read `docs/projects/crafting-ui/TRACKER.md` and `docs/projects/crafting-ui/GAPS.md`.
3. Start with G2+G5 as a single implementation slice.
4. After G2+G5, evaluate G7 (stats dispatch coverage for non-alchemy panels).
5. G4 and G6 remain follow-up work — do not widen scope without explicit reason.
6. Check `docs/projects/PROJECT_TRACKER.md` only if a gap needs routing back to `Crafting System`.



## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
