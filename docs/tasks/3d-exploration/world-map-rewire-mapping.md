# World Map Rewire Mapping

**Status**: Active mapping artifact, renderer bridge landed and parity still pending  
**Last Reviewed**: 2026-03-14

## Purpose

Document the coupling between the world-map UI, travel behavior, save/load, and submap anchoring so the Azgaar-atlas path can keep replacing legacy renderer assumptions safely.

## Verified Current Anchors

A 2026-03-14 repo check confirmed:
- `src/components/MapPane.tsx` exists and already carries the Azgaar atlas bridge plus fallback grid mode
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
- the legacy assumptions have not been fully retired yet
- the high-risk contracts are still map seed stability, travel correctness, and submap anchoring

## Next Practical Use

Use this file when touching:
- `MapPane`
- map travel click behavior
- map seed setup
- save/load world-map persistence
- submap continuity and hidden-cell anchoring
