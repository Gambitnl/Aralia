
# useSubmapProceduralData Hook

## Purpose

The `useSubmapProceduralData` custom React hook encapsulates the procedural generation concerns that power `SubmapPane.tsx`. It produces deterministic hashes, seeded feature placement, optional cellular automata grids for cave/dungeon biomes, and path layouts that avoid feature collisions while keeping the starting submap stable.

## Interface

```typescript
interface UseSubmapProceduralDataProps {
  submapDimensions: { rows: number; cols: number };
  currentWorldBiomeId: string;
  parentWorldMapCoords: { x: number; y: number };
  seededFeaturesConfig?: SeededFeatureConfig[]; // From SubmapPane's biomeVisualsConfig
  worldSeed: number;
}

interface UseSubmapProceduralDataOutput {
  simpleHash: (submapX: number, submapY: number, seedSuffix: string) => number;
  activeSeededFeatures: Array<{ x: number; y: number; config: SeededFeatureConfig; actualSize: number }>;
  pathDetails: PathDetails; // Contains mainPathCoords and pathAdjacencyCoords Sets
  caGrid?: CaTileType[][];
}

function useSubmapProceduralData(props: UseSubmapProceduralDataProps): UseSubmapProceduralDataOutput;
```

*   **`submapDimensions`**: The row and column count of the submap.
*   **`currentWorldBiomeId`**: The ID of the biome for the parent world map tile.
*   **`parentWorldMapCoords`**: The (x,y) coordinates of the parent world map tile.
*   **`seededFeaturesConfig`**: The configuration array for seeded features, typically passed from `SubmapPane`'s `biomeVisualsConfig`.
*   **`worldSeed`**: The world seed used to keep submap and CA generation deterministic across sessions.


## Return Value

The hook returns an object containing:

*   **`simpleHash: (submapX, submapY, seedSuffix) => number`**:
    *   A memoized hash function. Takes submap tile coordinates and a string suffix to generate a pseudo-random number. Crucially, it incorporates `worldSeed`, `parentWorldMapCoords`, and `currentWorldBiomeId` into its internal seed string, ensuring unique procedural generation for each distinct world map tile.

*   **`activeSeededFeatures: Array<{...}>`**:
    *   A memoized array. Each object in the array represents an instance of a seeded feature to be placed on the submap, including its seed coordinates (`x`, `y`), its specific `config` (from `seededFeaturesConfig`), and its `actualSize` (randomly determined within `config.sizeRange`).

*   **`pathDetails: { mainPathCoords: Set<string>; pathAdjacencyCoords: Set<string> }`**:
    *   A memoized object.
    *   `mainPathCoords`: A `Set` of strings (e.g., "x,y") representing tiles that are part of a main path.
    *   `pathAdjacencyCoords`: A `Set` of strings representing tiles adjacent to the main path.
    *   The path generation logic considers the biome (e.g., less chance of paths in swamps). If it's the initial starting submap, it explicitly adds the **fixed center coordinates** of that submap to `mainPathCoords`.
    *   When a CA grid is produced for caves/dungeons, standard paths are skipped to let the generated cavern map define traversable space.
*   **`caGrid?: CaTileType[][]`**:
    *   Optional 2D grid returned when the biome uses cellular automata (cave/dungeon). Generated with a deterministic seed derived from `worldSeed` and the parent coordinates.
    *   Enables `SubmapPane` to render CA tiles instead of standard path/feature tiles when present.

## Core Logic

*   **`simpleHash`**: Implements a basic string hashing algorithm anchored on `worldSeed`, biome, and parent coordinates.
*   **`caGrid`**: When the biome is `cave` or `dungeon`, generates a deterministic cellular automata grid instead of standard paths/features.
*   **`activeSeededFeatures`**: Iterates through `seededFeaturesConfig`. For each feature type, it uses `simpleHash` to determine how many instances to place and their random seed coordinates and sizes within the submap. Features that collide with the main path are skipped.
*   **`pathDetails`**: Uses `simpleHash` to decide if a path exists, its orientation (vertical/horizontal), its starting position, and its "wobble" as it traverses the submap. It then calculates adjacent tiles. If it's the initial starting submap, it explicitly adds the fixed center coordinates of that submap to `mainPathCoords`. When `caGrid` exists, path generation is bypassed.

## Usage

```typescript
// In SubmapPane.tsx
import { useSubmapProceduralData } from '../hooks/useSubmapProceduralData';
// ... other imports ...

const SubmapPane: React.FC<SubmapPaneProps> = ({
  currentWorldBiomeId,
  submapDimensions,
  parentWorldMapCoords,
  // ... other props ...
}) => {
  // ... get visualsConfig ...
  const { simpleHash, activeSeededFeatures, pathDetails, caGrid } = useSubmapProceduralData({
    submapDimensions,
    currentWorldBiomeId,
    parentWorldMapCoords,
    seededFeaturesConfig: visualsConfig.seededFeatures,
    worldSeed,
  });

  // Now use simpleHash, activeSeededFeatures, pathDetails for rendering decisions
  // ...
};
```

## Benefits

*   **Separation of Concerns**: Isolates complex procedural generation logic from the rendering logic in `SubmapPane.tsx`.
*   **Readability & Maintainability**: Makes both the hook and `SubmapPane.tsx` easier to understand and manage.
*   **Memoization**: Ensures that data is re-calculated only when relevant dependencies change, improving performance.
*   **Testability**: The hook's logic can be tested more easily in isolation.
*   **Static Paths**: Ensures paths on submaps are stable and don't shift with player movement. Player correctly starts on the path in the initial submap.

## Dependencies
*   `react`: For `useMemo`, `useCallback`.
*   `../constants`: For `LOCATIONS`, `STARTING_LOCATION_ID`, `BIOMES`.
*   `../services/cellularAutomataService`: For CA grids used in cave/dungeon biomes.
*   Types defined within the hook file (`SeededFeatureConfig`, `PathDetails`, `CaTileType`) or imported from `../types`.
