# Gap: Terrain Data Fallback Correctness

**Priority:** High  
**Status:** Narrowed, not fully closed  
**Last Reverified:** 2026-03-11

## Verified Current State

The current material service is more capable than the older version of this gap note implied.

Verified file:
- [`src/systems/spells/ai/MaterialTagService.ts`](../../../src/systems/spells/ai/MaterialTagService.ts)

Verified behavior:
- it already tries to derive concrete terrain/material context from submap tile information
- it only falls back to biome-level inference when the more specific tile route is unavailable

## What The Real Gap Is Now

The remaining correctness risk is the fallback path.

When concrete submap/tile context is unavailable, the service still infers likely materials from the biome, which can be wrong in mixed-material scenes.

## Why It Still Matters

This can still mislead context-sensitive spells:
- stone-like biomes can contain wooden or worked surfaces
- forest-like areas can contain masonry, ruins, or metal structures

## Current Follow-Through

1. Keep using the current tile-aware path where available.
2. Tighten or limit the biome fallback so it does not present guesses as if they were concrete local facts.
3. Re-test context-sensitive spells against scenes with mixed materials.
