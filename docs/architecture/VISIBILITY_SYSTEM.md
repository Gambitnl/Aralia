# Visibility System Integration Guide

## Overview

The visibility system provides mechanical support for light levels, line of sight, and vision-based tile visibility in combat-style map contexts.

This guide remains useful, but the older version drifted on the exact API shape.

## Verified Current Components

### VisibilitySystem

Location:
- src/systems/visibility/VisibilitySystem.ts

Current verified public methods used by the guide are:
- calculateLightLevels(mapData, lightSources)
- calculateVisibility(observer, mapData, lightLevels)

The older guide referred to getVisibleTiles, but the current implementation uses calculateVisibility and returns a visibility map keyed by tile id.

### useVisibility Hook

Location:
- src/hooks/combat/useVisibility.ts

The hook currently returns:
- lightLevels
- visibleTiles
- canSeeTile
- getLightLevel

Internally, the hook calls VisibilitySystem.calculateVisibility and converts non-hidden results into the visibleTiles set consumed by UI code.

## Current Behavior Notes

### Light Levels

The system currently calculates tile light levels from active light sources.
The hook also applies an ambient-light shortcut:
- cave and dungeon themes default to darkness
- bright environments can be treated as fully bright without per-source calculation

That ambient behavior lives in the hook, not as a third ambientLight argument on VisibilitySystem.calculateLightLevels.

### Vision

The current system accounts for:
- line of sight
- darkvision
- blindsight
- per-tile visibility tiers

The older guide was directionally right about those mechanics, but the exact function names and data flow have changed.

## UI Integration Guidance

For battle-map style UI integration:
1. Use the useVisibility hook from a combat-facing surface.
2. Pass or consume lightLevels and visibleTiles where tile rendering decisions are made.
3. Treat tiles outside visibleTiles as hidden or obscured according to the UI surface's needs.
4. Use getLightLevel when the renderer needs a brightness distinction among visible tiles.

## Mechanics Integration Guidance

For targeting or action validation:
1. Determine the observer or acting character.
2. Calculate or obtain current lightLevels.
3. Use VisibilitySystem.calculateVisibility or the hook-derived visibleTiles set.
4. Reject or constrain targeting when the target tile is not visible under the current rules.

## Historical Drift To Note

The older version of this file drifted in these specific ways:
- it referred to getVisibleTiles even though the current system uses calculateVisibility
- it documented calculateLightLevels as if it accepted an ambientLight argument directly
- it described the hook more cleanly than the current adapter layer actually behaves

## What This Means

Keep this file as a live integration guide, but verify the actual API before extending it.
The important architecture remains valid:
- visibility is a dedicated system
- the React hook is an adapter layer
- UI and targeting logic should consume shared visibility results rather than inventing parallel lighting rules
