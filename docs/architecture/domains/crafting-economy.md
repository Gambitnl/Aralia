# Crafting & Economy

Verified: 2026-10-28 against source, focused tests and actual source-guided Menaikon workshop use, ordinary manual save and Continue reload. The earlier subsystem inventory remains a historical March 2026 review.

## Physical town workstations: current verification

Actual recovered Sana play opens Character Sheet, Crafting and Alchemy Bench through ordinary controls. The screen reports Basic Workshop while the body remains beside Menaikon's sewer entrance. Its dropdown offers laboratory, apothecary, wizard and black-market locations without a source visit. Sana has zero known or craftable recipes. No ingredients, money or time were spent in this inspection. CookingSystem.ts currently has test recipe callers but no production cooking recipe flow; the earlier list of cooking code is not proof of playable cooking.

Alchemy recipes take full workdays. A source-bound multi-day project needs work-hour scheduling, permission, storage and persistence across leaving and returning. A short keeper shift cannot be treated as continuous permission through lunch and overnight. This integration is not implemented or accepted. The unrestricted character-sheet location path also remains open work; its behavior has been preserved rather than silently relabeled as physical access.

The first physical workbench candidate therefore uses the existing short-session SalvageModal, whose equipment jobs take minutes. workbenchAccess.ts reuses furnishingReachError and attendanceForVisit: actual same-room/floor footfall, a public business workshop/forge room and a working proprietor are required. A job may finish exactly at closing but cannot cross an unstaffed interval. Nineteen focused access/reach cases pass. Household benches and their goods receive no permission. The optional source-bound salvage path retains recovered materials; an ordinary merchant transaction is needed to turn them into coins. The historical standalone salvage conversion remains unchanged.

World3DWrapper now connects actual public bench examination to the existing salvage window. Source-guided ordinary clicks and walking reached Roban Westsmith's workbench in Menaikon plot 156, workshop room 3, level 0. The shop door was opened normally. Two separate spare daggers were dismantled with natural rolls 11 and 13 against DC 10, each taking 20 game minutes and recovering two iron scraps and one leather strip. Gold stayed 20.77, HP 9, and the reached body stayed X445.5756037522279/Y3.368223923082281/Z484.8692435742837 in cell 4337. No body, clock, inventory or roll override was used. This was an isolated continuation of the recovered Sana Chronicle, not persisted defeat aftermath or unaided route discovery.

The first played result exposed generic ADD_ITEM replacing material IDs with UUIDs. The source-bound path now uses existing GIVE_ITEM with complete catalog stacks: iron_scrap quantity 2 and leather_strip quantity 1. A real characterReducer-to-checkMaterials regression verifies recipe recognition. The three earlier UUID material units remain untouched; historical standalone conversion behavior is preserved. Actual ordinary Save Game through the new existing SystemMenu integration created aralia_rpg_default_save at game time 0351-01-03T15:05:41. Full page reload and Continue restored the same body, HP, gold and 15 inventory entries; the manual payload retains one spare dagger, both canonical material stacks and all earlier UUID units. Saved-state backend migration to IndexedDB was observed and inspected read-only.

Desktop and 390x844 phone renders were inspected. Phone inventory, preview and confirmation now share one scrolling flow; filters wrap and the Dismantle button is reachable. Equipment asset paths use the existing item visual resolver rather than appearing as literal text. Movement while the workshop is open leaves body position unchanged. Thirty-seven distinct focused tests pass across physical reach, station access, salvage and wrapper/menu lifecycle; six scoped files typecheck with zero errors and zero suppressed diagnostics. The 12 salvage tests also pass after the responsive repair. Preserve the alchemy, cooking, crafting and salvage scaffolds while connecting other stations and persistent multi-day projects. This accepts the bounded public salvage loop, not a complete crafting workday, household stock permission, merchant resale, cooking or all-town access.

## Cooking integration dependency

Checked 2026-10-28: CookingSystem.ts resolves specific/tagged ingredients and delegates to attemptCraft. Its INGREDIENT_TAGS is a mock ID table; production cooking recipes and a player entry are still absent. The live meal contract in systems/travel/partyMeal.ts consumes coupled canonical rations and water whole-person-days after rechecking the selected source, party, expiry and quantities. It clears existing starvation/fatigue and resets meal cadence without HP or rest recovery. Other foods remain explicitly deferred. A physical cooking integration must reuse this authority or agree a portion/output extension with its owner; it must not invent a second nutrition model or treat household supplies as free ingredients.

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
