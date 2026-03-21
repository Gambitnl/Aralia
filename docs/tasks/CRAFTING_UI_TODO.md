# Crafting System UI Integration
This file was re-verified on 2026-03-14.
It is preserved as a crafting-UI backlog note, not as proof that the crafting backend is still entirely isolated from newer UI structure decisions.

Current reality:
- the crafting and salvage backends still exist in `src/systems/crafting/`
- the old integration point naming is partially stale because the doc still points at a flat `src/components/Inventory/InventoryList.tsx` path that no longer exists in that form


## Context
The Alchemist persona has established the backend logic for a crafting system, including recipe validation, skill checks with quality outcomes, and material consumption. However, there is currently no user interface for players to interact with this system.

## Task
Create a UI for the crafting system that allows players to:
1. View available recipes based on nearby stations (e.g., Forge, Alchemy Bench).
2. See material requirements and current inventory status.
3. Attempt to craft items.
4. Visualize the outcome (success/failure, quality, consumed materials).

## Key Components
- `RecipeList`: A list of recipes filtered by the current station.
- `CraftingPanel`: Details of the selected recipe, inputs, and projected outputs.
- `CraftingResultModal`: Displays the result of the craft (Success/Fail/Quality).

## Data Integration
- Use `src/systems/crafting/craftingSystem.ts` for logic (`attemptCraft`).
- Use `src/systems/crafting/data/recipes.ts` for initial data.

## Assigned Persona
This task is best suited for the **Forge** (Infrastructure/Build) or **Merchant** (Assets/UI) personas.

// TODO(Merchant): Build the UI for the Crafting System.
