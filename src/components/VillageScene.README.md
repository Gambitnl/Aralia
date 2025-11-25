# VillageScene Component

## Purpose

`VillageScene.tsx` renders the in-village experience using a canvas-style layout. It plots procedurally determined buildings (inn, shop, workshop, etc.), paths, and interaction hotspots based on generated village data. The scene is reached through the village game phase and is designed to feel distinct per settlement seed.

## Visual Reference

![Canvas-style village layout with building callouts](../../docs/images/village-scene.svg)

## Core Responsibilities

*   **Canvas Rendering**: Draws terrain, roads, and building footprints so each village feels spatially unique.
*   **Interaction Surfaces**: Building hitboxes drive actions such as opening merchant flows or triggering quick travel back to the overworld.
*   **Phase Awareness**: Operates when the game is in `VILLAGE_VIEW`, coordinating with map/village state and world seed data.
*   **Performance Considerations**: Keeps visuals lightweight to match the procedural map cadence.

## Current Status

*   **Scene Visuals Paused**: The related `ImagePane.tsx`/image-generation path is intentionally disabled to avoid exceeding API quotas. The canvas layout remains the primary presentation.
*   **Future Enhancements**: Expand building variety, layer NPC sprites, and surface more tooltips for available services.
