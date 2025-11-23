
# useSubmapProceduralData Hook

## Purpose

The `useSubmapProceduralData` custom React hook is designed to encapsulate and manage the procedural generation of data required by the `SubmapPane.tsx` component. This includes:

1.  **Deterministic Hashing (`simpleHash`)**: Provides a hash function that generates consistent pseudo-random numbers based on submap coordinates, the parent world map tile's coordinates, and the biome ID. This is crucial for ensuring that submap features are generated consistently for any given tile.
2.  **Seeded Feature Placement (`activeSeededFeatures`)**: Calculates the positions and actual sizes of major "seeded" features (like ponds, thickets, villages) within the submap grid based on configurations defined in `SubmapPane.tsx`.
3.  **Path Generation (`pathDetails`)**: Determines the coordinates for main paths running through the submap and the tiles adjacent to these paths.
    *   **Path Stability**: The main path's layout (starting point and general course) is static for all submaps, including the starting one. It is determined solely by world coordinates and biome.
    *   **Starting Path Guarantee**: For the player's initial starting submap (the one corresponding to `STARTING_LOCATION_ID`), this hook explicitly ensures that the submap's **fixed center coordinates** (e.g., `cols/2`, `rows/2`) are included in the `mainPathCoords` set. Since the player character also begins at these center coordinates, this guarantees they start on a path tile, and the path remains static. This fixes previous issues where the path might dynamically adjust to the player's current position on the starting submap.

By extracting this logic, `SubmapPane.tsx` can focus more on the visual rendering of the submap, while the data generation aspect is handled by this hook.

## Interface

```typescript
interface UseSubmapProceduralDataProps {
  submapDimensions: { rows: number; cols: number };
  currentWorldBiomeId: string;
  parentWorldMapCoords: { x: number; y: number };
  seededFeaturesConfig?: SeededFeatureConfig[]; // From SubmapPane's biomeVisualsConfig
  // playerSubmapCoordsForPath prop has been removed
}

interface UseSubmapProceduralDataOutput {
  simpleHash: (submapX: number, submapY: number, seedSuffix: string) => number;
  activeSeededFeatures: Array<{ x: number; y: number; config: SeededFeatureConfig; actualSize: number }>;
  pathDetails: PathDetails; // Contains mainPathCoords and pathAdjacencyCoords Sets
}

function useSubmapProceduralData(props: UseSubmapProceduralDataProps): UseSubmapProceduralDataOutput;
```

*   **`submapDimensions`**: The row and column count of the submap.
*   **`currentWorldBiomeId`**: The ID of the biome for the parent world map tile.
*   **`parentWorldMapCoords`**: The (x,y) coordinates of the parent world map tile.
*   **`seededFeaturesConfig`**: The configuration array for seeded features, typically passed from `SubmapPane`'s `biomeVisualsConfig`.


## Return Value

The hook returns an object containing:

*   **`simpleHash: (submapX, submapY, seedSuffix) => number`**:
    *   A memoized hash function. Takes submap tile coordinates and a string suffix to generate a pseudo-random number. Crucially, it incorporates `parentWorldMapCoords` and `currentWorldBiomeId` into its internal seed string, ensuring unique procedural generation for each distinct world map tile.

*   **`activeSeededFeatures: Array<{...}>`**:
    *   A memoized array. Each object in the array represents an instance of a seeded feature to be placed on the submap, including its seed coordinates (`x`, `y`), its specific `config` (from `seededFeaturesConfig`), and its `actualSize` (randomly determined within `config.sizeRange`).

*   **`pathDetails: { mainPathCoords: Set<string>; pathAdjacencyCoords: Set<string> }`**:
    *   A memoized object.
    *   `mainPathCoords`: A `Set` of strings (e.g., "x,y") representing tiles that are part of a main path.
    *   `pathAdjacencyCoords`: A `Set` of strings representing tiles adjacent to the main path.
    *   The path generation logic considers the biome (e.g., less chance of paths in swamps). If it's the initial starting submap, it explicitly adds the **fixed center coordinates** of that submap to `mainPathCoords`.

## Core Logic

*   **`simpleHash`**: Implements a basic string hashing algorithm.
*   **`activeSeededFeatures`**: Iterates through `seededFeaturesConfig`. For each feature type, it uses `simpleHash` to determine how many instances to place and their random seed coordinates and sizes within the submap.
*   **`pathDetails`**: Uses `simpleHash` to decide if a path exists, its orientation (vertical/horizontal), its starting position, and its "wobble" as it traverses the submap. It then calculates adjacent tiles. If it's the initial starting submap, it explicitly adds the fixed center coordinates of that submap to `mainPathCoords`.

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
  const { simpleHash, activeSeededFeatures, pathDetails } = useSubmapProceduralData({
    submapDimensions,
    currentWorldBiomeId,
    parentWorldMapCoords,
    seededFeaturesConfig: visualsConfig.seededFeatures,
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
*   Types defined within the hook file (`SeededFeatureConfig`, `PathDetails`) or imported from `../types`.
