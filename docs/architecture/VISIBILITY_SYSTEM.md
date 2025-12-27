# Visibility System Integration Guide

## Overview
The `VisibilitySystem` provides mechanical support for Light, Darkness, and Vision in the Underdark (and other environments). It calculates light levels per tile and determines which tiles are visible to a specific character based on their position, senses (Darkvision), and the lighting conditions.

## Components

### 1. `VisibilitySystem` (Static Class)
Located in: `src/systems/visibility/VisibilitySystem.ts`

- `calculateLightLevels(mapData, lightSources, ambientLight)`: Returns a `Map<string, LightLevel>` ('bright', 'dim', 'darkness').
- `getVisibleTiles(observer, mapData, lightMap)`: Returns a `Set<string>` of visible tile IDs.

### 2. `useVisibility` (Hook)
Located in: `src/hooks/combat/useVisibility.ts`

Wraps the static system for React components.

```typescript
const { lightLevels, visibleTiles, canSeeTile } = useVisibility({
  combatState,
  viewerId: 'player-character-id' // Optional: defaults to active character
});
```

## Integration Steps for UI (BattleMap)

To visualize the Fog of War:

1. **Consume the Hook**: In `CombatView.tsx` or `BattleMap.tsx`, call `useVisibility`.
2. **Pass Props**: Pass `lightLevels` and `visibleTiles` to the `BattleMap` component.
3. **Render Logic**:
   - In `BattleMapTile.tsx`:
     - If `!visibleTiles.has(tile.id)`: Render as "Fog" (greyed out, no tokens) or "Void" (black).
     - If `visible`: Check `lightLevels.get(tile.id)`.
       - `darkness`: Apply dark overlay (unless using Darkvision/Monochrome shader).
       - `dim`: Apply dim overlay.
       - `bright`: Render normally.

## Integration Steps for Mechanics (Targeting)

To enforce "You cannot target what you cannot see":

1. **Input Validation**: In `useAbilitySystem` or `validateTarget`:
   ```typescript
   const visibleTiles = VisibilitySystem.getVisibleTiles(caster, map, lightLevels);
   if (!visibleTiles.has(targetTileId)) {
     throw new Error("Target is not visible.");
   }
   ```

## Underdark Defaults
- Default Ambient Light: `darkness` (unless `theme` overrides).
- Darkvision: Allows seeing in `darkness` as if it were `dim` (Monochrome).
