# Map Configuration (`src/config/mapConfig.ts`)

## Purpose

The `mapConfig.ts` module centralizes all static configuration variables related to the game's various maps and grids. This includes the world map, submaps, and battle maps.

Decoupling this configuration from the main `constants.ts` file improves modularity and makes it easier to locate and manage map-specific settings.

## Exports

*   **`MAP_GRID_SIZE: { rows: number; cols: number }`**:
    *   Defines the dimensions of the main world map grid.

*   **`SUBMAP_DIMENSIONS: { rows: number; cols: number }`**:
    *   Defines the dimensions of the local submap grids that are generated for each world map tile.

*   **`BATTLE_MAP_DIMENSIONS: { width: number; height: number }`**:
    *   Defines the dimensions for procedural battle maps.

*   **`TILE_SIZE_PX: number`**:
    *   The size of a single tile in pixels, used for rendering grid-based maps.

*   **`DIRECTION_VECTORS: Record<string, DirectionVector>`**:
    *   An object that maps compass direction strings (e.g., "North," "SouthEast") to their corresponding `(dx, dy)` vectors for grid calculations. This is essential for movement logic.
