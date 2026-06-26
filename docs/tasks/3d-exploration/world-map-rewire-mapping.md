# World Map Rewire Mapping

**Status**: Active mapping artifact, renderer bridge landed and parity still pending  
**Last Reviewed**: 2026-03-14

## Purpose

Document the coupling between the world-map UI, travel behavior, save/load, and submap anchoring so the Azgaar-atlas path can keep replacing legacy renderer assumptions safely.

## Verified Current Anchors

A 2026-06-22 repo check confirmed:
- `src/components/MapPane.tsx` exists and carries the Azgaar atlas bridge plus a native World Forge render-port option
- the player-facing legacy `MapTile` grid mode/fallback has been removed from `MapPane`
- `src/services/mapService.ts` still owns the world-map generation entry path
- `src/services/azgaarDerivedMapService.ts` still exists as the current Azgaar-derived generation lane
- `src/hooks/useGameInitialization.ts` and reducer/state surfaces still preserve the map and seed contracts this file talks about
- `src/hooks/useSubmapProceduralData.ts` still depends on stable world coordinates for submap generation

## Current Reading Rule

This is still a live mapping artifact.

It should be read as:
- a protected-contract map for the current world-map migration
- a parity checklist for atlas click travel, save/load, and submap anchoring

It should not be read as proof that all parity checks have already been fully closed.

## Rebased Summary

The important current truth is:
- the renderer-bridge phase has already landed
- the visible legacy square-grid renderer is no longer exposed from `MapPane`
- the legacy `MapData.tiles` gameplay/state assumptions have not been fully retired yet
- the high-risk contracts are still map seed stability, travel correctness, and submap anchoring

## Preserved Compatibility Contracts

This deprecation pass intentionally preserves `MapData.tiles` and `MapTile`
data payloads behind the atlas click bridge. The removed React grid renderer was
only a presentation path; these state contracts still feed:
- world-map travel and `MOVE_PLAYER` dispatch payloads
- discovery/current-tile state mutation
- save/load and `WorldData` v2 migration
- submap biome anchoring and neighbor-biome blending
- POI visibility and marker derivation
- AI observation/location context
- Enter-3D cell-to-world-position resolution

Do not delete `MapData.tiles`, the `MapTile` data type, or the migration adapter
as part of renderer cleanup. They need a separate contract migration before
removal is safe.

## Next Practical Use

Use this file when touching:
- `MapPane`
- map travel click behavior
- map seed setup
- save/load world-map persistence
- submap continuity and hidden-cell anchoring

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/3d-exploration/world-map-rewire-mapping.md","sha256WithoutMarker":"0dc9823567d5c34ed04c75e98651dcb45a25411810a33510e17a7c06f65fd949","markedAtUtc":"2026-06-25T22:29:38.600Z"} -->
