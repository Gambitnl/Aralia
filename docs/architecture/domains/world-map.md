# World Map

## Purpose

The World Map domain handles region-level navigation, high-level geography, and the bridge from world-scale travel selection into more local exploration surfaces.

## Verified Current Entry Points

High-signal current entry points verified in this pass:
- src/components/MapPane.tsx
- src/components/MapTile.tsx
- src/components/WorldPane.tsx
- src/components/Minimap.tsx
- src/services/mapService.ts

## Current Domain Shape

The older version of this file described a straightforward grid-zoom world map.
The current MapPane implementation is more specific:
- it is a world map modal surface
- the default mode is an embedded Azgaar atlas
- the app uses a click-to-world-cell bridge to preserve Aralia travel logic
- the file still renders tile-aware components such as MapTile, but the overall interaction model is no longer just a simple CSS-scaled grid

## Historical Drift Corrected

The older navigation-mechanics section drifted in a concrete way:
- it described zoom and pan as a CSS transform model with local scale and offset as the core implementation
- the live MapPane now centers on the Azgaar embed bridge and related interaction state

That older explanation should not be treated as the current implementation guide.

## Boundaries And Constraints

- The world map remains a region-scale selection and navigation surface, not a replacement for submap or town-scale traversal.
- World-map interactions must preserve the bridge into the rest of the game's travel and discovery flow.
- Embedded atlas behavior and Aralia-owned state need to stay aligned so the visual layer does not become a separate game state authority.

## What Is Materially Implemented

This pass verified that the world-map domain already has:
- a live MapPane surface
- MapTile and supporting world-map UI pieces
- a map service layer
- minimap and overview surfaces
- a real bridge between the embedded atlas presentation and Aralia's world/travel logic

## Open Follow-Through Questions

- Which parts of the world-map behavior are still intentionally Azgaar-driven versus fully Aralia-owned?
- Which world-map docs should now describe the embed bridge explicitly rather than the older pure-grid model?
- How should discovery, POI markers, and regeneration controls be documented so the domain map stays truthful as the world tools evolve?
