
# Plan: Improving the Current System for Biome Transitions

## 1. Purpose

The goal of this improvement is to enhance immersion by creating smooth, gradual transitions between different biomes on the submap. When a player travels from a "plains" world tile to a "forest" world tile, the edge of the new forest submap should contain a few rows of plains terrain, making the change feel natural rather than abrupt.

This plan outlines an **algorithmic enhancement** to the existing procedural generation system. It does not require a new library or a fundamental architectural change.

---

## 2. Implementation Plan

### Phase 1: Pass Context During Player Movement

**Goal:** Modify the movement logic to be aware of the biome the player is leaving, and pass this information to the submap generator.

-   [ ] **Modify `handleMovement` Action Handler**
    -   **File**: `src/hooks/actions/handleMovement.ts`
    -   **Action**: When calculating a move that results in a transition to a new world map tile, the function must identify the biome of the *starting* tile and the *destination* tile, as well as the direction of entry.
    -   **Envisioned Code Direction**:
        ```typescript
        // Inside handleMovement.ts, in the "Moving to a new world map tile" block

        const startingWorldTile = gameState.mapData.tiles[currentWorldY][currentWorldX];
        const startingBiomeId = startingWorldTile.biomeId;

        // ... existing logic to determine targetWorldTile and targetBiome ...
        
        // The payload for MOVE_PLAYER needs to be expanded.
        const movePayload = {
          newLocationId,
          newSubMapCoordinates,
          mapData: newMapDataForDispatch,
          activeDynamicNpcIds: activeDynamicNpcIdsForNewLocation,
          // --- NEW PROPERTIES ---
          transitionContext: {
            previousBiomeId: startingBiomeId,
            entryDirection: directionKey, // 'North', 'South', etc.
          }
        };

        dispatch({ type: 'MOVE_PLAYER', payload: movePayload });
        ```

### Phase 2: Integrate Context into Submap Generation

**Goal:** Thread the new `transitionContext` down to the components and hooks responsible for generating the submap.

-   [ ] **Update `SubmapPane` Component**
    -   **File**: `src/components/SubmapPane.tsx`
    -   **Action**: The component must accept, store, and pass the `transitionContext` to the `useSubmapProceduralData` hook.
    -   **Envisioned Code Direction**:
        ```typescript
        // In SubmapPane.tsx props interface
        interface SubmapPaneProps {
          // ... existing props
          transitionContext?: { previousBiomeId: string; entryDirection: string; };
        }

        // Inside SubmapPane component
        const { simpleHash, ... } = useSubmapProceduralData({
          // ... existing props
          transitionContext: props.transitionContext // Pass it to the hook
        });
        ```

-   [ ] **Update `useSubmapProceduralData` Hook**
    -   **File**: `src/hooks/useSubmapProceduralData.ts`
    -   **Action**: The hook will accept the new `transitionContext` and use it to calculate a "transition zone" on the map.
    -   **Envisioned Code Direction**:
        ```typescript
        // In useSubmapProceduralData.ts props and output interfaces
        interface UseSubmapProceduralDataProps {
          // ... existing props
          transitionContext?: { previousBiomeId: string; entryDirection: string; };
        }

        interface UseSubmapProceduralDataOutput {
          // ... existing outputs
          transitionZone?: { biomeId: string; coords: Set<string>; };
        }
        
        // Inside the main hook logic, add a new useMemo for the transition zone
        const transitionZone = useMemo(() => {
          if (!transitionContext || transitionContext.previousBiomeId === currentWorldBiomeId) {
            return undefined;
          }
          
          const coords = new Set<string>();
          const depth = simpleHash(0, 0, 'transition_depth') % 5 + 1; // Random depth from 1-5
          const { entryDirection } = transitionContext;
          
          // Logic to populate the 'coords' set based on entryDirection and depth
          // For example, if entryDirection is 'South' (player came from North):
          for (let y = rows - 1; y >= rows - depth; y--) {
            for (let x = 0; x < cols; x++) {
              coords.add(`${x},${y}`);
            }
          }
          // ... implement for all directions ...
          
          return { biomeId: transitionContext.previousBiomeId, coords };

        }, [transitionContext, currentWorldBiomeId, submapDimensions, simpleHash]);
        
        // Return it in the hook's output
        return { simpleHash, activeSeededFeatures, pathDetails, transitionZone };
        ```

### Phase 3: Apply Blended Visuals During Rendering

**Goal:** Modify the tile rendering logic to use the visual recipe of the *previous* biome when a tile falls within the calculated transition zone.

-   [ ] **Modify `SubmapPane.tsx` Rendering Logic**
    -   **File**: `src/components/SubmapPane.tsx`
    -   **Action**: The `getTileVisuals` helper function will be the final arbiter. It will check if a tile's coordinates are in the `transitionZone` set.
    -   **Envisioned Code Direction**:
        ```typescript
        // In SubmapPane.tsx
        
        const getTileVisuals = useCallback((rowIndex: number, colIndex: number): VisualLayerOutput => {
          const tileKey = `${colIndex},${rowIndex}`;
          
          // --- NEW LOGIC: Check for transition override ---
          if (transitionZone && transitionZone.coords.has(tileKey)) {
            // Fetch the VISUALS for the PREVIOUS biome instead of the current one.
            const previousVisualsConfig = biomeVisualsConfig[transitionZone.biomeId] || defaultBiomeVisuals;
            // Run the standard visual generation functions, but with the overridden config.
            const tileHash = simpleHash(colIndex, rowIndex, 'tile_visual_seed_v4');
            let visuals = getBaseVisuals(rowIndex, colIndex, tileHash, previousVisualsConfig);
            // NOTE: We might intentionally skip path/feature generation in the transition zone
            // to make it feel like the edge of a region. For now, just render base terrain.
            visuals = applyScatterVisuals(visuals, tileHash, previousVisualsConfig);
            return visuals;
          }
          
          // --- EXISTING LOGIC ---
          // If not in a transition zone, proceed with the normal visual generation for the current biome.
          const tileHash = simpleHash(colIndex, rowIndex, 'tile_visual_seed_v4');
          let visuals = getBaseVisuals(rowIndex, colIndex, tileHash, visualsConfig);
          visuals = applyPathVisuals(visuals, rowIndex, colIndex, pathDetails, visualsConfig, tileHash);
          visuals = applySeededFeatureVisuals(visuals, rowIndex, colIndex, activeSeededFeatures);
          visuals = applyScatterVisuals(visuals, tileHash, visualsConfig);
          visuals.tooltipContent = getHintForTile(...);
          return visuals;

        }, [/* ... dependencies ... */, transitionZone]); // Add transitionZone to dependency array
        ```

## 3. Files Affected / Deprecated

-   **Files to be Modified**:
    -   `src/types.ts` (to add `transitionContext` to the `MOVE_PLAYER` payload type)
    -   `src/hooks/actions/handleMovement.ts`
    -   `src/components/SubmapPane.tsx`
    -   `src/hooks/useSubmapProceduralData.ts`
-   **New Files**: None
-   **Deprecated Files**: None

## 4. Risks and Mitigation

-   **Risk**: Increased complexity in the `useSubmapProceduralData` hook and `SubmapPane` component.
    -   **Mitigation**: The logic is well-encapsulated. The changes are additive and can be feature-flagged or easily reversed if they cause issues. Thorough testing of all biome transition directions is required.
-   **Risk**: Performance impact from additional checks during rendering.
    -   **Mitigation**: The use of `Set` for coordinate lookups is highly performant (O(1)). The impact should be negligible, but can be verified with the React Profiler.
