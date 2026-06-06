# Crafting System North Star

Status: active
Last updated: 2026-06-05

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
   - `craftingSystem.ts` and `craftingEngine.ts` overlap on core behavior with different contracts and quality models.
2. **Input/model fidelity drift**
   - `craftingService.ts` still validates materials by exact ID only and explicitly notes `TODO: Implement matchByItemType logic`.
   - `craftingEngine.ts` includes fuzzy substring checks for tool names, which is useful but brittle.
3. **Mocked character integration in UI**
   - `GatheringPanel.tsx` and `CreatureHarvestPanel.tsx` use locally mocked crafters rather than selected-party extraction.
4. **Experiment side effects not fully closed**
   - `ExperimentPanel.tsx` logs experimental explosions but does not apply HP/damage effects to combat/party state in the current flow.
5. **Feature branch completeness**
   - `RefiningSystem.ts` and `EnchantingSystem.ts` contain TODOs indicating deeper UI selection/flow integration and critical-failure behavior presentation is still partial.
6. **Persistence edge**
   - Save/load is version-aware but does not have explicit crafting-schema migration/backfill logic beyond generic state handling.
7. **Remaining alchemy and glossary follow-ups**
   - `alchemySystem.ts` still points at a missing drag-and-drop experimentation path into the bench UI.
   - `ingredientGlossary.ts` still falls back creature rarity from `challengeRating ?? 0` when creature data omits CR.

## Dashboard Card Schema

Project: Crafting System
Slug: crafting
Category: Gameplay System
Status: active
Confidence: high
Evidence: docs/projects/crafting
Gap signal: 8 open gaps
Protocol: living project doc set
Next step: Pick the highest-priority open gap in `GAPS.md` and keep its proof check current.
Required verification: docs_consistency
Completed verification: none
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## Evidence map (for handoff)
- Systems: `src/systems/crafting/craftingEngine.ts`, `craftingSystem.ts`, `batchCrafting.ts`, `craftingLocations.ts`, `craftingAchievements.ts`, `crafterProgression.ts`, `craftingService.ts`, `ingredientGlossary.ts`.
- UI: `src/components/Crafting/index.ts`, `AlchemyBenchPanel.tsx`, `GatheringPanel.tsx`, `CreatureHarvestPanel.tsx`, `ExperimentPanel.tsx`, `IngredientGlossaryPanel.tsx`, `src/components/CharacterSheet/Crafting/CraftingTab.tsx`.
- State: `src/types/crafting.ts`, `src/types/state.ts`, `src/state/actionTypes.ts`, `src/state/reducers/craftingReducer.ts`, `src/state/appState.ts`, `src/services/saveLoadService.ts`, `src/state/initialState.ts`.
- Cross-feature evidence: `src/components/Combat/CombatView.tsx`, `src/systems/crafting/creatureHarvestData.ts`.

## Cross-boundary intent
The project should preserve both:
- Existing shipped behavior in UI and state actions.
- An explicit modernization track for the duplicate engine stack (legacy vs enhanced), avoiding accidental removal of either path before usage contracts are fully reconciled.

## Resume path for a cold start
1. Start here: `docs/projects/crafting/NORTH_STAR.md`.
2. Review owned work queue and task state: `docs/projects/crafting/TRACKER.md`.
3. Review concrete implementation gaps: `docs/projects/crafting/GAPS.md` (G1-G8).
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
