# Crafting UI North Star

Status: active
Last updated: 2026-05-31

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
  - Adds harvested items via `ADD_ITEM`.
- `CreatureHarvestPanel`:
  - Triggered in `src/components/Combat/CombatView.tsx` only.
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

- UI and systems contract boundary is still split: registry now explicitly marks this project as needing reconciliation with systems/crafting.
- Some flows still rely on simplified placeholders:
  - Gathering and creature harvest use mock crafter objects rather than full character skill model.
  - Experiment result side effects include text-only damage logging instead of party damage dispatch.
  - Only AlchemyBenchPanel is wrapped in `WindowFrame`; Gathering and harvest use custom overlays.
- No dedicated craft UI tests were observed during this scan.
- Action typing is not fully strict for crafting stat updates (`string` payload fields).

## Relationship to docs/projects/crafting

`docs/projects/PROJECT_TRACKER.md` already includes a Crafting UI row with evidence and explicit unresolved follow-up.
The systems project (`Crafting System` row) owns gameplay logic; this project owns UI surface reality and integration evidence.

## Active slice

| Field | Value |
|---|---|
| Task | Convert registry evidence into a concrete cold-start Crafting UI implementation map |
| Acceptance criteria | North Star and tracker show implemented file coverage, integration surface, and in-scope gaps with proof anchors |
| Allowed files | `docs/projects/crafting-ui/NORTH_STAR.md`, `docs/projects/crafting-ui/TRACKER.md`, `docs/projects/crafting-ui/GAPS.md` |
| Stop condition | Docs reflect current implementation state clearly enough for any engineer to continue work without re-scanning all craft surfaces |
| Verification | Manual file-map verification against `src/components/Crafting` and `src/components/CharacterSheet` and `src/components/Combat/CombatView.tsx` |

## Resume path

1. Read this file.
2. Read `docs/projects/crafting-ui/TRACKER.md`.
3. Read `docs/projects/crafting-ui/GAPS.md`.
4. Compare contracts in `docs/projects/PROJECT_TRACKER.md` and decide if the unresolved systems gap is now being handled.
5. Continue with whichever first in-scope gap is blocking implementation confidence.



## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
