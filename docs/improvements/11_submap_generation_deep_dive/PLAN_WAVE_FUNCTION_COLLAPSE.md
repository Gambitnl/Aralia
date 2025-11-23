
# Plan: Wave Function Collapse for Structured Map Generation

## 1. Purpose

The goal of this improvement is to introduce the **Wave Function Collapse (WFC)** algorithm for procedural map generation. WFC is a more advanced technique that excels at creating highly structured, logical, and non-random-looking layouts based on a set of adjacency rules. It is the "better tool" for generating complex environments like `villages`, `ruins`, or intricate `dungeons` where elements must connect logically (e.g., walls must form buildings, roads must connect).

This is a significant, long-term architectural enhancement that will dramatically increase the quality and believability of structured submaps.

---

## 2. Implementation Plan

### Phase 1: Library Integration and Ruleset Definition

**Goal:** Integrate a WFC library and define the first set of "tiles" and "rules" for a specific biome.

-   [ ] **Select and Integrate WFC Library**
    -   **Action**: Research and select a lightweight, dependency-free WFC library that is available on a CDN like `esm.sh`. Add it to the `<script type="importmap">` in `index.html`.
    -   **Contingency**: If no suitable library is found, a simplified version of the WFC algorithm can be implemented, but this significantly increases complexity. The priority is to use an existing, battle-tested library.

-   [ ] **Create WFC Ruleset Configuration**
    -   **File Structure**: Create a new directory `src/config/wfcRulesets/`.
    -   **Action**: Create a new file `src/config/wfcRulesets/village.ts` to define the tiles and rules for generating a village.
    -   **Envisioned Code Content**:
        ```typescript
        // src/config/wfcRulesets/village.ts
        /**
         * @file village.ts
         * Defines the tile data and adjacency rules for generating a village submap
         * using the Wave Function Collapse algorithm.
         */

        // Define the visual representation of each tile type
        export const villageTiles = [
          { id: 'grass', icon: '🟩', weight: 10 },
          { id: 'road_ns', icon: '│', weight: 5 }, // North-South road
          { id: 'road_ew', icon: '─', weight: 5 }, // East-West road
          { id: 'road_nsew', icon: '┼', weight: 1 }, // Crossroads
          { id: 'wall_n', icon: '▀', weight: 3 }, // North-facing wall
          { id: 'wall_s', icon: '▄', weight: 3 }, // South-facing wall
          { id: 'roof', icon: '🟫', weight: 2 }, // Building roof/interior
          // ... add more tiles for corners, doors, etc.
        ];

        // Define the adjacency rules: which tiles can be next to which others
        export const villageAdjacencyRules = [
          // A north-south road must connect to another N-S road or a crossroads above/below it
          { tileA: 'road_ns', direction: 'north', tileB: ['road_ns', 'road_nsew'] },
          { tileA: 'road_ns', direction: 'south', tileB: ['road_ns', 'road_nsew'] },
          // A roof tile must be surrounded by other roof tiles or wall tiles
          { tileA: 'roof', direction: 'any', tileB: ['roof', 'wall_n', 'wall_s', /* etc. */] },
          // ... many more rules to define a coherent village structure
        ];
        ```

### Phase 2: Create the WFC Generation Service

**Goal:** Create a service that wraps the WFC library and provides a simple interface for the rest of the application.

-   [ ] **Create New File**: `src/services/wfcService.ts`
-   **Envisioned Code Content**:
    ```typescript
    // src/services/wfcService.ts
    import { wfcLibrary } from 'wfc-library'; // Assumes library is in importmap
    import { villageTiles, villageAdjacencyRules } from '../config/wfcRulesets/village';
    
    export type WfcTile = { id: string; icon: string; };

    export function generateWfcMap(
      width: number,
      height: number,
      biome: 'village' // could be expanded later
    ): WfcTile[][] {
      // 1. Get the ruleset for the requested biome
      const tiles = villageTiles;
      const rules = villageAdjacencyRules;

      // 2. Configure the WFC generator from the library
      const generator = new wfcLibrary.Generator(width, height, {
        tiles: tiles,
        rules: rules,
        // ... other library-specific config ...
      });

      // 3. Run the generation
      const resultGrid = generator.generate();

      // 4. Map the library's output to our application's WfcTile format
      const finalGrid: WfcTile[][] = mapLibraryResultToOurFormat(resultGrid);

      return finalGrid;
    }
    ```

### Phase 3: Integrate WFC into Submap Generation

**Goal:** Update the main generation hook to call the WFC service for designated biomes.

-   [ ] **Modify `useSubmapProceduralData.ts`**
    -   **Action**: Similar to the Cellular Automata integration, the hook will route to the WFC service for specific biomes.
    -   **Envisioned Code Direction**:
        ```typescript
        // In useSubmapProceduralData.ts
        import { generateWfcMap, WfcTile } from '../services/wfcService';

        interface UseSubmapProceduralDataOutput {
          // ... existing outputs
          wfcGrid?: WfcTile[][];
        }

        // Inside the hook
        const wfcGrid = useMemo(() => {
          if (currentWorldBiomeId === 'village') {
            return generateWfcMap(submapDimensions.cols, submapDimensions.rows, 'village');
          }
          return undefined;
        }, [currentWorldBiomeId, submapDimensions]);
        
        return { /* ..., */ wfcGrid };
        ```

-   [ ] **Modify `SubmapPane.tsx`**
    -   **Action**: Update the rendering logic to display the `wfcGrid`. Since the grid already contains visual information (the icon), the logic will be very simple.
    -   **Envisioned Code Direction**:
        ```tsx
        // In SubmapPane.tsx's rendering loop
        const { wfcGrid, ... } = useSubmapProceduralData({ ... });

        if (wfcGrid) {
          // Render based on the WFC grid
          const tile = wfcGrid[rowIndex]?.[colIndex];
          return <div ...>{tile ? tile.icon : '?'}</div>;
        } else {
          // Fallback to existing CA or standard procedural rendering
          // ...
        }
        ```

## 3. Files Affected / Deprecated

-   **Files to be Modified**:
    -   `index.html` (to add the WFC library to the importmap)
    -   `src/hooks/useSubmapProceduralData.ts`
    -   `src/components/SubmapPane.tsx`
-   **New Files**:
    -   `src/services/wfcService.ts`
    -   `src/config/wfcRulesets/village.ts` (and others for different biomes)
-   **Deprecated Files**: None. This is an additive feature.

## 4. Risks and Mitigation

-   **Risk**: **High Complexity**. WFC is a powerful but complex algorithm. Defining a good ruleset is non-trivial and can be time-consuming.
    -   **Mitigation**: Start with a very simple biome (like a walled town) and a minimal set of tiles and rules. Expand iteratively. Rely heavily on the chosen library's documentation and examples.
-   **Risk**: **Performance**. The WFC algorithm can be computationally expensive, potentially causing a noticeable delay when generating a new submap.
    -   **Mitigation**: The generation only happens once per submap visit thanks to `useMemo`. For a 25x25 grid, performance should be acceptable on modern devices. If it becomes an issue, we could show a "Building area..." loading state or explore Web Workers to run the generation in a background thread.
