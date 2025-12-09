# Gap: Dynamic Terrain

**Status:** Open
**Priority:** Medium
**Type:** System Capability Gap
**Source:** Code Review of `src/commands/effects/TerrainCommand.ts`

## Findings
The `TerrainCommand.ts` file contains a stubbed implementation:
```typescript
// TODO: This requires map state modification system
// BattleMapTile needs to support dynamic terrain effects
```
Currently, spells like *Grease*, *Web*, *Spike Growth*, or *Mold Earth* execute by:
1. Calculating the area of effect.
2. Logging a message to the combat log ("Caster creates grease").
3. **Doing nothing else.**

The actual `BattleMapData` (the grid of tiles) is not modified. A "Grass" tile remains "Grass". It does not become "Difficult Terrain" or gain a "Slippery" property. Characters walking through it will trigger no mechanical effects (no saving throws, no speed reduction).

## Affected Areas
- `src/commands/effects/TerrainCommand.ts`
- `src/types/combat.ts` (BattleMapTile definition)
- Map Rendering System (needs to visualize the grease/web)

## Proposed Solution
1.  **Define Mutation Interface:**
    Create a `MapMutationService` or update `BattleMapTile` to support a `layers` or `effects` array (e.g., `tile.effects.push('grease')`).

2.  **Update TerrainCommand:**
    Inject `GameState` or `MapData` access into `TerrainCommand`.
    Implement logic to update the specific tiles in `affectedTiles`:
    ```typescript
    state.mapData.tiles[x][y].effects.push(effect.id);
    state.mapData.tiles[x][y].movementCost = 2; // Difficult terrain
    ```

3.  **Visualization:**
    Ensure the frontend renderer reads these new tile properties and draws an overlay (Web texture, Grease puddle).

## Acceptance Criteria
- [ ] `BattleMapTile` supports dynamic effects/modifiers.
- [ ] `TerrainCommand` modifies the map state.
- [ ] Movement logic respects the new movement costs (Difficult Terrain).
