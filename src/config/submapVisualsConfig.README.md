# Submap Visuals Configuration (`src/config/submapVisualsConfig.ts`)

## Purpose

The `submapVisualsConfig.ts` module is a critical configuration file that defines the entire visual aesthetic for the procedurally generated submaps in `SubmapPane.tsx`. It contains a large, structured object (`biomeVisualsConfig`) that maps biome IDs to their specific visual recipes.

By externalizing this complex configuration, we can easily create, modify, and tune the appearance of different biomes without altering the React rendering logic in `SubmapPane.tsx`.

## Structure

The file exports two main constants:

*   **`biomeVisualsConfig: Record<string, BiomeVisuals>`**:
    *   This is the main export. It's an object where each key is a biome ID (e.g., `"forest"`, `"plains"`) and the value is a `BiomeVisuals` object.
    *   The `BiomeVisuals` type (defined in `src/types.ts`) specifies all the visual parameters for a biome, including:
        *   `baseColors`: An array of background colors for the base terrain.
        *   `pathColor`: The color for path tiles.
        *   `pathIcon`: An optional emoji for path tiles.
        *   `pathAdjacency`: Optional colors and scatter icons for tiles next to a path.
        *   `seededFeatures`: An array of `SeededFeatureConfig` objects that define major features like ponds, thickets, or villages.
        *   `scatterFeatures`: An array of `MicroFeatureVisual` objects for minor details like trees, grass, and rocks that are scattered across the map.

*   **`defaultBiomeVisuals: BiomeVisuals`**:
    *   A fallback `BiomeVisuals` object used by `SubmapPane.tsx` if the current biome ID is not found in `biomeVisualsConfig`. This prevents the application from crashing if it encounters an unconfigured biome.
