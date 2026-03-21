# Town Map

## Purpose

The Town Map domain covers deterministic town and village exploration surfaces, including generated layouts, local movement, building interaction entry points, merchant access, and town-scoped rendering helpers.

## Verified Current Entry Points

High-signal current entry points verified in this pass:
- src/components/Town/TownCanvas.tsx
- src/components/Town/VillageScene.tsx
- src/hooks/useTownController.ts
- src/services/RealmSmithTownGenerator.ts
- src/state/reducers/townReducer.ts
- src/types/town.ts

## Current Domain Shape

The live town-map domain currently has two related render surfaces:
- TownCanvas.tsx is the main live town-exploration surface used from App.tsx.
- VillageScene.tsx is a deterministic village-layout surface with building-click actions and village-context payloads.

The generation and movement stack is spread across:
- RealmSmithTownGenerator.ts
- BuildingGenerator.ts
- RoadGenerator.ts
- TerrainGenerator.ts
- DoodadGenerator.ts
- useTownController.ts
- townReducer.ts

TownCanvas.tsx also makes the current rendering model more specific than the older doc:
- it is a canvas-based renderer driven through AssetPainter
- it supports movement, zoom, pan, ambient-life rendering, and building/NPC interaction hooks
- it is not well described anymore by the older shorthand of main isometric/2D rendering

## Historical Drift Corrected

The older version of this file drifted in a few concrete ways:
- it claimed a lowercase src/services/realmsmith/**/*.ts ownership lane that does not match the verified current paths
- it implied a simpler renderer description than the current TownCanvas plus AssetPainter flow warrants
- it listed src/components/__tests__/MerchantModal.test.tsx, which is not present in the current repo

That older explanation should not be treated as the current implementation guide.

## Boundaries And Constraints

- Town generation remains deterministic from seed and world-position inputs.
- Town navigation should continue to respect walkability and building collision.
- Town rendering, merchant entry, and NPC-click handling can live here without making the town domain the owner of all inventory, dialogue, or combat systems.
- Broader claims like town never triggers combat directly or exit points always return to the correct submap tile should be documented carefully unless they are explicitly verified in code.

## What Is Materially Implemented

This pass verified that the town-map domain already has:
- a live TownCanvas surface wired through App.tsx
- a deterministic VillageScene surface
- a town-controller hook for generation, spawn placement, pan, zoom, and view state
- a town reducer and town type lane
- the RealmSmith town-generation stack and its supporting generator files
- merchant-entry actions from town and village buildings
- NPC/ambient-life interaction hooks in the canvas surface

## Verified Test Surface

Verified tests in this pass:
- src/components/Town/__tests__/TownCanvasPan.test.tsx
- src/components/Town/__tests__/TownDevControls.test.tsx
- src/components/Town/__tests__/TownNavigationControls.test.tsx
- src/hooks/__tests__/useTownController.test.tsx
- src/services/__tests__/strongholdService.test.ts

The older claim about src/components/__tests__/MerchantModal.test.tsx was not accurate in the current repo.

## Open Follow-Through Questions

- Which docs should explain the TownCanvas plus AssetPainter rendering model more directly?
- How should the repo distinguish the main town-exploration surface from the narrower deterministic VillageScene lane?
- Which building-interaction and merchant-entry rules should be documented here versus in dialogue, trade, or inventory docs?
