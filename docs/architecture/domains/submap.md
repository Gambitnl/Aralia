# Submap

## Purpose

The Submap domain is the main local exploration surface for moving through a world-map region, resolving terrain presentation, local travel affordances, inspection, and nearby world-to-town or world-to-combat transitions.

## Verified Current Entry Points

High-signal current entry points verified in this pass:
- src/components/Submap/SubmapPane.tsx
- src/hooks/useSubmapProceduralData.ts
- src/components/Submap/SubmapTile.tsx
- src/components/Submap/useQuickTravel.ts
- src/components/Submap/useInspectableTiles.ts
- src/components/Submap/submapVisuals.ts
- src/config/submapVisualsConfig.ts

## Current Domain Shape

The live submap stack currently splits across several layers:
- SubmapPane.tsx is the main orchestration surface.
- useSubmapProceduralData.ts generates deterministic path, feature, CA, WFC, and biome-blend data.
- Colocated helpers such as useQuickTravel.ts, useInspectableTiles.ts, useSubmapGlossaryItems.ts, useSubmapGrid.ts, and useTileHintGenerator.ts support interaction and presentation.
- submapVisuals.ts resolves per-tile visuals, while src/config/submapVisualsConfig.ts supplies the underlying visual configuration.

The repo still contains a src/components/Submap/painters/ lane and hooks/usePixiApplication.ts, so the older painter-related notes were not fully obsolete.
What drifted was the assumption that those painter files still define the whole domain.
The live submap architecture is now broader and more React/UI-driven than that older wording implied.

## Historical Drift Corrected

The older version of this file drifted in three main ways:
- it treated submapData.ts as a more central domain entry point than the current hook-plus-config-plus-helper split supports
- it described src/components/Submap/hooks/*.ts as a stable ownership directory, but the current submap hooks are mostly colocated directly in src/components/Submap/ plus src/hooks/useSubmapProceduralData.ts
- it overcorrected against the painter lane by suggesting Pixi-related references were simply gone, when those files still exist in the repo

That older explanation should not be treated as the current implementation guide.

## Boundaries And Constraints

- Submap remains the local exploration surface, not the owner of combat execution or town rendering.
- World context still flows in from the world-map layer, while town and combat remain downstream transition surfaces.
- Procedural generation should stay deterministic for a given seed and coordinate set.
- Boundary rules like trap-detection ownership or deeper town-transition semantics should be documented as architecture notes unless verified directly in code.

## What Is Materially Implemented

This pass verified that the submap domain already has:
- a live SubmapPane surface
- deterministic procedural generation based on seed, biome, and parent world coordinates
- quick-travel and pathfinding helper surfaces
- inspectable tile support
- day/night overlay handling
- glossary-item support for submap visuals
- WFC and cellular-automata generation lanes
- a still-present painter lane alongside the newer UI/helper split

## Verified Test Surface

Verified tests in this pass:
- src/components/Submap/__tests__/SubmapPane.test.tsx
- src/services/villageGenerator.test.ts

The older claims about src/utils/__tests__/visualUtils.test.ts and src/utils/__tests__/pathfindingHeuristic.test.ts were not accurate in the current repo.

## Open Follow-Through Questions

- How should the painter lane be described now that it still exists but no longer fully defines the submap architecture?
- Should submapData.ts remain a named domain entry point, or should the docs emphasize the current hook/config/helper split instead?
- Which trap, hazard, and discovery systems still belong in submap documentation versus broader exploration or combat references?
