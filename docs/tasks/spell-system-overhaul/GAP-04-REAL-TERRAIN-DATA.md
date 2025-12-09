# Gap: Real Terrain Data Integration

**Priority:** High (Correctness)
**Status:** Open
**Detected:** Dec 2025 (Agent Epsilon Review)

## Findings
The newly implemented `MaterialTagService.ts` currently relies on a **heuristic guess**:
```typescript
// Current Implementation
const biomeId = gameState.currentLocation?.split('_')[0] || 'plains';
const materials = this.inferMaterialsFromBiome(biomeId);
```
It assumes "Forest" always means "Wood/Dirt", ignoring that a specific tile might be a stone ruin, a metal hatch, or a pool of water.

## The Problem
**Hallucination Risk:**
- A player stands on a wooden bridge in a "Mountain" biome.
- The Heuristic sees "Mountain" -> infers "Stone".
- The player casts "Meld into Stone" on the wooden bridge.
- The AI allows it because it thinks the bridge is stone.

## Proposed Solution
Connect `MaterialTagService` to the actual `Submap` or `BattleMap` data model.

### 1. Access Tile Data
- The `GameState` object should ideally expose the `activeSubmap` or `currentTile` data.
- If not available, we need to pass the `MapService` or `SubmapContext` to the arbitrator.

### 2. Update `MaterialTagService`
- **Logic:**
    1. Check `gameState.submap.tiles[x][y]`.
    2. Read `terrainType` (e.g., "water", "wall_stone").
    3. Read `features` (e.g., "statue", "chest").
    4. Pass *these* concrete details to the AI prompt instead of the generic biome guess.

## Dependencies
- Requires deep knowledge of `src/types/map.ts` and how the map is stored in Redux/State.
