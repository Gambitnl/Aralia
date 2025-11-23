# In-Depth Explanation: The Submap Generation System

This document provides a comprehensive, step-by-step explanation of how the procedural submap generation system in Aralia RPG functions. It details the flow of data and logic from the moment a player enters a new area to the final rendered grid.

## 1. Core Philosophy: Deterministic Generation

The entire system is built on the principle of **deterministic procedural generation**. This means that for any given world map tile, the submap generated will be identical every single time it is visited within the same game. This creates a persistent, explorable world rather than a completely random one. The "seed" for this generation is derived from the world map coordinates and the biome type of the tile.

---

## 2. The Generation Pipeline: From Trigger to Render

The process can be broken down into a clear pipeline involving three key files.

### Step 1: The Trigger (`SubmapPane.tsx`)

-   **File**: `src/components/SubmapPane.tsx`
-   **Role**: **The Renderer and Orchestrator.**
-   **Function**: The process begins when the `SubmapPane` component is rendered by `App.tsx`. Its primary job is to call the "brain" of the system to get the map data and then render the visual grid of tiles.

### Step 2: The Brain (`useSubmapProceduralData.ts`)

-   **File**: `src/hooks/useSubmapProceduralData.ts`
-   **Role**: **The Logic Core.**
-   **Function**: This custom React hook is the engine of the submap. It doesn't draw anything; it calculates the *layout* of the entire submap once and provides that data to the `SubmapPane`.
    -   **Inputs**: It receives the `parentWorldMapCoords` (e.g., `{x: 15, y: 10}`) and the `currentWorldBiomeId` (e.g., `"forest"`).
    -   **The Seed**: It combines these inputs into a unique seed string (e.g., `"15,10,forest,tile_visual_seed_v4"`). This string is used in a **`simpleHash` function**, which is a deterministic pseudo-random number generator (PRNG).
    -   **Outputs**: It uses this hash function to calculate and return:
        -   `activeSeededFeatures`: An array detailing all major features (like ponds or thickets), including their type, size, and exact coordinates on the submap.
        -   `pathDetails`: A data structure containing the coordinates for a main path and its adjacent tiles.
        -   `simpleHash`: The PRNG function itself, which is passed back to the `SubmapPane` for minor, per-tile randomization (like scatter features).

### Step 3: The Recipe Book (`submapVisualsConfig.ts`)

-   **File**: `src/config/submapVisualsConfig.ts`
-   **Role**: **The Visual Configuration.**
-   **Function**: This file acts as the "art department." It contains a large configuration object, `biomeVisualsConfig`, that defines the visual "recipe" for each biome. It specifies:
    -   `baseColors`: The possible background colors for the terrain.
    -   `pathColor`: The color of paths.
    -   `seededFeatures`: A list of *potential* major features that can spawn in that biome. The `useSubmapProceduralData` hook reads this list to decide *which* features to actually place and where.
    -   `scatterFeatures`: A list of minor icons (like `🌲`, `🌿`) and their `density` (spawn chance).

### Step 4: The Rendering Loop (Back in `SubmapPane.tsx`)

-   **Function**: With the layout data from the hook and the visual recipes from the config, the `SubmapPane` renders the grid.
-   **Process**:
    1.  It iterates through every coordinate of its 25x25 grid.
    2.  For each coordinate, it calls a helper function, **`getTileVisuals`**.
    3.  `getTileVisuals` first checks if the coordinate matches a major feature (like a path or a pond) from the data provided by the `useSubmapProceduralData` hook. If it does, it applies that feature's specific visual style (e.g., the pond's blue color and '💧' icon).
    4.  If it's not a major feature, it uses the `simpleHash` function to pseudo-randomly select a `baseColor` from the biome's recipe and then rolls against the `density` of each `scatterFeature` to decide if a minor icon (like a single tree) should be placed there.
    5.  This final visual information (CSS styles and a React node for the icon) is returned and rendered as a `<div>` in the grid.

---

## 3. Dependency Flowchart

The interaction between these parts can be visualized as follows:

```
[App.tsx]
   |
   | Renders...
   v
[SubmapPane.tsx] (Renderer)
   |
   | Calls Hook with (Coords, BiomeID)
   v
[useSubmapProceduralData.ts] (Logic Core)
   |        |
   | Uses...|
   |        v
   |      [submapVisualsConfig.ts] (Visual Recipes for features)
   |
   | Returns (Layout Data, Hash Function)
   v
[SubmapPane.tsx]
   |
   | For each tile, uses Layout Data + Hash Function + Visual Recipes to render the grid.
   |
   v
[Final Rendered Submap]
```

This modular architecture effectively separates the *what* (the visual design in the config file) from the *how* (the generation logic in the hook and the rendering in the component), making the system powerful, flexible, and easy to maintain.
