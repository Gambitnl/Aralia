
# Map Service (`src/services/mapService.ts`)

## Purpose

The `mapService.ts` module is responsible for the procedural generation of the world map in Aralia RPG. It creates the grid-based `MapData` structure, populates it with tiles, assigns biomes to these tiles, and links predefined game locations to their corresponding positions on the map.

## Core Functionality

The primary function exported by this service is `generateMap`.

### `generateMap(rows, cols, locations, biomes): MapData`

*   **Parameters**:
    *   `rows: number`: The number of rows for the map grid.
    *   `cols: number`: The number of columns for the map grid.
    *   `locations: Record<string, Location>`: An object containing all predefined game locations (from `src/constants.ts`), used to place them on the map.
    *   `biomes: Record<string, Biome>`: An object containing all defined biome types (from `src/constants.ts`), used for assigning biomes to tiles.

*   **Returns**: `MapData` - An object containing the `gridSize` and a 2D array (`tiles`) of `MapTile` objects.

*   **Logic**:
    1.  **Initialization**:
        *   Creates an empty 2D array for `tiles`.
        *   Identifies all `passableBiomeIds` from the `biomes` data. Throws an error if no passable biomes are defined, as this would make map generation impossible.
        *   Initializes each tile in the grid (`tiles[r][c]`) with:
            *   `x`, `y` coordinates.
            *   A randomly assigned `biomeId` from the `passableBiomeIds`.
            *   `discovered: false`.
            *   `isPlayerCurrent: false`.

    2.  **Placing Predefined Locations**:
        *   Iterates through the `locations` object.
        *   For each location that has `mapCoordinates` and a `biomeId` defined:
            *   Sets the `biomeId` of the corresponding tile at `(x, y)` to the location's `biomeId`.
            *   Sets the `locationId` of the tile to the location's `id`.
            *   If the location is the `STARTING_LOCATION_ID`:
                *   Marks its tile as `isPlayerCurrent = true`.
                *   Marks its tile and all immediately adjacent tiles as `discovered = true`.

    3.  **Basic Biome Clustering**:
        *   A simple iterative clustering algorithm is applied to make biomes somewhat contiguous:
            *   It runs for a few passes (currently 3).
            *   In each pass, it iterates over all tiles.
            *   Tiles corresponding to predefined locations (and their specified `biomeId`) are **not** changed by this clustering pass.
            *   For other tiles, it looks at its 8 neighbors:
                *   Counts the occurrences of each neighboring biome type.
                *   Identifies the `dominantNeighborBiome` (the most frequent one among neighbors).
                *   If a `dominantNeighborBiome` exists, is passable, and a random chance (50%) passes, the current tile's `biomeId` is changed to this dominant biome. This encourages small clusters of similar biomes to form around the initial seeds (predefined locations) and other generated areas.
            *   If a tile (not a predefined location tile) ends up with an impassable biome after this process, it's reassigned a random passable biome to ensure general traversability of unkeyed areas.
        *   *Note*: This is a naive clustering approach. More sophisticated algorithms (like Perlin noise or cellular automata) would produce more natural and varied biome zones but are more complex to implement.

    4.  **Return Value**: Returns the fully populated `MapData` object.

## Data Dependencies

*   **`src/types.ts`**: Relies on `MapData`, `MapTile`, `Location`, and `Biome` type definitions.
*   **`src/constants.ts`**: Uses `STARTING_LOCATION_ID` to identify the player's initial position for discovery. (It receives `LOCATIONS` and `BIOMES` as parameters, which are typically sourced from `constants.ts`).

## Usage

The `generateMap` function is typically called in `App.tsx` when a new game is started (`handleNewGame` or `startGame`) to initialize the `gameState.mapData`.

```typescript
// Example in App.tsx
import { generateMap } from './services/mapService';
import { MAP_GRID_SIZE, LOCATIONS, BIOMES } from './constants';

// ...
const newMapData = generateMap(MAP_GRID_SIZE.rows, MAP_GRID_SIZE.cols, LOCATIONS, BIOMES);
setGameState(prev => ({ ...prev, mapData: newMapData }));
// ...
```

## Future Considerations

*   Implement more advanced procedural generation algorithms for biome placement to create more organic and varied world maps.
*   Allow the generation of dynamic points of interest or even basic `Location` data for tiles that don't correspond to predefined locations.
