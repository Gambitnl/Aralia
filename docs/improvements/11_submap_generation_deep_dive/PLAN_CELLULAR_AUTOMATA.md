- [x] Plan Completed

# Plan: Cellular Automata for Organic Map Generation

## 1. Purpose

The goal of this improvement is to introduce a **Cellular Automata (CA)** algorithm for procedural generation. This algorithm excels at creating natural, organic-looking structures, making it a "better tool" for specific biomes like `cave` or `dungeon` which should not feel like open fields with random obstacles.

This will significantly increase the visual variety and thematic appropriateness of underground environments.

---

## 2. Implementation Plan

### Phase 1: Create the Cellular Automata Service

**Goal:** Build a self-contained, reusable service that implements the core CA logic.

-   [x] **Create New File**: `src/services/cellularAutomataService.ts`
-   **File and Folder Structure**: This new service will live alongside other core services.
-   **Envisioned Code Content**:
    ```typescript
    // src/services/cellularAutomataService.ts
    /**
     * @file cellularAutomataService.ts
     * A service for generating 2D grid maps using a Cellular Automata algorithm.
     * Ideal for creating organic cave-like structures.
     *
     * DEPENDS ON:
     * - ../utils/seededRandom.ts (for deterministic randomness)
     *
     * USED BY:
     * - ../hooks/useSubmapProceduralData.ts
     */
    import { SeededRandom } from '../utils/seededRandom';

    export type CaTileType = 'floor' | 'wall';

    export class CellularAutomataGenerator {
      private random: SeededRandom;
      private width: number;
      private height: number;
      private grid: CaTileType[][];

      constructor(width: number, height: number, seed: number) {
        this.width = width;
        this.height = height;
        this.random = new SeededRandom(seed);
        this.grid = [];
      }
      
      // Step 1: Initialize the grid with random noise
      private initializeGrid(fillProbability: number) {
        // ... logic to create a 2D array and fill with 'wall' or 'floor' based on probability ...
      }

      // Step 2: Run the simulation for a number of steps
      private doSimulationStep(wallThreshold: number) {
        // ... logic to create a new grid, iterate through each cell, count its 'wall' neighbors,
        // and apply the rule (e.g., if neighbors > threshold, become a wall).
        // Then, replace the old grid with the new one.
      }

      // Main public method to generate the map
      public generateMap(
        fillProbability: number = 0.45,
        simulationSteps: number = 5,
        wallThreshold: number = 4
      ): CaTileType[][] {
        this.initializeGrid(fillProbability);
        for (let i = 0; i < simulationSteps; i++) {
          this.doSimulationStep(wallThreshold);
        }
        return this.grid;
      }
    }
    ```

### Phase 2: Integrate CA into the Submap Generation Hook

**Goal:** Modify the main procedural data hook to call the new CA service when it detects a relevant biome.

-   [x] **Modify `useSubmapProceduralData.ts`**
    -   **File**: `src/hooks/useSubmapProceduralData.ts`
    -   **Action**: The hook will become a router. It will check the `currentWorldBiomeId`. If it's `cave` or `dungeon`, it will use the `CellularAutomataGenerator`; otherwise, it will use the existing seeded feature and path logic.
    -   **Envisioned Code Direction**:
        ```typescript
        // src/hooks/useSubmapProceduralData.ts
        import { CellularAutomataGenerator, CaTileType } from '../services/cellularAutomataService';

        // Add a new property to the hook's output type
        interface UseSubmapProceduralDataOutput {
          // ... existing outputs
          caGrid?: CaTileType[][]; // Will contain the grid for CA-generated maps
        }
        
        // Inside the main hook function
        const useSubmapProceduralData = ({ ... }): UseSubmapProceduralDataOutput => {
          // ... existing simpleHash, etc. ...

          const caGrid = useMemo(() => {
            if (currentWorldBiomeId === 'cave' || currentWorldBiomeId === 'dungeon') {
              const seed = simpleHash(0, 0, 'ca_seed');
              const generator = new CellularAutomataGenerator(submapDimensions.cols, submapDimensions.rows, seed);
              // Parameters can be tuned here per-biome if needed
              return generator.generateMap();
            }
            return undefined; // Not a CA biome
          }, [currentWorldBiomeId, submapDimensions, simpleHash]);
          
          // Return the CA grid alongside the other data.
          // The other data (paths, features) will be empty/unused for CA maps.
          return { simpleHash, activeSeededFeatures, pathDetails, caGrid };
        };
        ```

### Phase 3: Add Visuals and Update Rendering Logic

**Goal:** Teach the `SubmapPane` how to render the new `caGrid` data.

-   [x] **Define Visuals in Config**
    -   **File**: `src/config/submapVisualsConfig.ts`
    -   **Action**: Add new entries for `cave` and `dungeon` biomes. These will be simpler than the others, primarily defining colors and icons for `wall` and `floor` tiles.
    -   **Envisioned Code Direction**:
        ```typescript
        // In src/config/submapVisualsConfig.ts
        export const biomeVisualsConfig: Record<string, BiomeVisuals> = {
          // ... existing biomes ...
          'cave': {
            baseColors: ['rgba(50, 45, 40, 0.8)'], // Base 'floor' color
            // No paths or seeded features needed for CA maps
            scatterFeatures: [
              { icon: '🪨', density: 0.05, allowedOn: ['floor'] }, // Scatter some rocks on the floor
              { icon: '💧', density: 0.02, allowedOn: ['floor'] }  // A dripping water effect
            ],
            // NEW property for CA
            caTileVisuals: {
              'wall': { color: 'rgba(20, 15, 10, 0.9)', icon: null },
              'floor': { color: 'rgba(50, 45, 40, 0.8)', icon: null }
            }
          }
        };
        ```

-   [x] **Modify `SubmapPane.tsx` Rendering Logic**
    -   **File**: `src/components/SubmapPane.tsx`
    -   **Action**: The `getTileVisuals` function must be updated to handle the `caGrid` output from the hook.
    -   **Envisioned Code Direction**:
        ```typescript
        // In SubmapPane.tsx
        
        // The hook now returns the caGrid
        const { caGrid, ... } = useSubmapProceduralData({ ... });

        const getTileVisuals = useCallback((rowIndex: number, colIndex: number): VisualLayerOutput => {
          // --- NEW LOGIC: Check for CA Grid first ---
          if (caGrid && visualsConfig.caTileVisuals) {
            const tileType = caGrid[rowIndex]?.[colIndex] || 'wall';
            const tileVisual = visualsConfig.caTileVisuals[tileType];
            
            let visuals = {
              style: { backgroundColor: tileVisual.color },
              content: tileVisual.icon,
              // ... other default properties ...
            };
            // Optionally apply scatter features on top of 'floor' tiles
            if (tileType === 'floor') {
                visuals = applyScatterVisuals(visuals, simpleHash(colIndex, rowIndex, 'ca_scatter'), visualsConfig);
            }
            return visuals;
          }
          
          // --- EXISTING LOGIC ---
          // If not a CA biome, proceed with the normal visual generation.
          // ...
        }, [caGrid, visualsConfig, /* ... other deps ... */]);
        ```

## 3. Files Affected / Deprecated

-   **Files to be Modified**:
    -   `src/hooks/useSubmapProceduralData.ts`
    -   `src/components/SubmapPane.tsx`
    -   `src/config/submapVisualsConfig.ts`
-   **New Files**:
    -   `src/services/cellularAutomataService.ts`
    -   `src/utils/seededRandom.ts` (This might already exist; if not, it should be created).
-   **Deprecated Files**: None. The new logic is additive and conditional.

## 4. Risks and Mitigation

-   **Risk**: Cellular Automata can sometimes generate disconnected "rooms."
    -   **Mitigation**: The `cellularAutomataService` can be enhanced with a post-processing step that runs a flood-fill algorithm to find the largest connected area and fills in any smaller, disconnected pockets, ensuring a single, navigable map. For an initial implementation, this is a low priority.
-   **Risk**: Performance of running the simulation in the hook.
    -   **Mitigation**: The CA algorithm is computationally simple and runs inside a `useMemo` hook, so it only executes once per submap. The performance impact will be negligible.