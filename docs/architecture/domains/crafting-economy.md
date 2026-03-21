# Crafting & Economy

## Purpose

This file should describe the crafting lane and its adjacent relationship to trade and economy systems.
The current repo has a real, broad crafting subtree, but it does not support the older claim that this one domain owns the overall game economy.

## Verified Entry Points

- src/systems/crafting/
- src/components/Crafting/
- src/components/CharacterSheet/Crafting/CraftingTab.tsx

## Current Shape

### Crafting systems verified in this pass

The current crafting subtree includes more than alchemy, enchanting, and salvaging.
This pass verified live crafting surfaces for:

- alchemy
- enchanting
- salvaging
- cooking
- gathering
- refining
- creature harvest
- batch crafting
- crafting service and engine support
- recipe and ingredient data under src/systems/crafting/data/

### Crafting UI verified in this pass

- src/components/Crafting/
- src/components/CharacterSheet/Crafting/CraftingTab.tsx

The Character Sheet still acts as the clearest verified consumer of the crafting lane.

## Important Boundary Correction

The previous version of this doc contradicted itself by saying both:

- this domain manages the overall game economy
- this domain owns only pure crafting mechanics

The current repo supports the narrower interpretation.

This domain should describe:

- src/systems/crafting/
- src/components/Crafting/
- src/components/CharacterSheet/Crafting/
- crafting-specific recipes, progression, harvesting, refining, and service logic

Economy and trade systems are real and important, but they belong primarily to the adjacent trade and economy lane that is now documented in items-trade-inventory.md and reinforced by:

- src/components/Trade/
- src/components/Economy/
- src/systems/economy/
- src/state/reducers/economyReducer.ts

## Dependencies

### Depends on

- Items / Trade / Inventory: crafting recipes and outputs still depend on the shared item lane.

### Used by

- Character Sheet: the verified crafting interface lives under the CharacterSheet crafting tab.

## Tests Verified In This Pass

The current crafting test surface includes:

- src/systems/crafting/__tests__/alchemySystem.test.ts
- src/systems/crafting/__tests__/CookingSystem.test.ts
- src/systems/crafting/__tests__/craftingService.test.ts
- src/systems/crafting/__tests__/craftingSystem.test.ts
- src/systems/crafting/__tests__/EnchantingSystem.test.ts
- src/systems/crafting/__tests__/gatheringSystem.test.ts
- src/systems/crafting/__tests__/RefiningSystem.test.ts
- src/systems/crafting/__tests__/salvageSystem.test.ts

Trade-route tests remain part of the adjacent trade and economy lane, not this one.

## Current Interpretation

Re-verified on 2026-03-11.
Treat this file as the crafting-domain note with economy as adjacent integration context, not as an ownership claim over the whole economy stack.
