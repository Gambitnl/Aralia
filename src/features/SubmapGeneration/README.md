# Submap Generation

This feature is responsible for the procedural generation of local submaps that the player explores.

## Architecture & Design History

This document provides a deep dive into the submap generation system for the Aralia RPG. It explains how the system works in relation to the core design requirements and details the algorithmic tools used to achieve diverse environments.

### How the Current Submap System Works

The system in place is a robust and well-designed **deterministic procedural generation** system. This means it creates dynamic, random-looking maps that are actually the same every time for a given starting "seed." This is a perfect design choice for ensuring a consistent and replayable world in each playthrough.

The core of this system is the `useSubmapProceduralData` hook (`src/hooks/useSubmapProceduralData.ts`), which acts as the central engine for generating the *data* of a submap. It takes the parent world map coordinates and biome ID as input and produces a memoized object containing the placement of all major features, including paths and seeded features like ponds or ruins.

The visual appearance of each biome is defined in `src/config/submapVisualsConfig.ts`, which acts as a "visual recipe book," separating artistic and design decisions from the core generation logic.

#### Path Connectivity

The illusion of connected roads between adjacent world map tiles is achieved in a clever, emergent way. Each submap generates its own path segment independently, but because the generation algorithm is deterministic and seeded by the world map coordinates, the paths naturally align at the borders. The system does not track a single, continuous "road object" across the entire world map.

#### Travel Time

Travel time is currently calculated using fixed, abstract time costs in the `handleMovement` action handler (`src/hooks/actions/handleMovement.ts`). A move between world map tiles costs 1 hour, and a move within a submap costs 30 minutes. The architecture is designed to be extensible to incorporate more granular calculations based on factors like mount speed, terrain type (roads), and character-specific movement rates.

### Implemented Algorithms

The submap generation system utilizes distinct algorithms tailored to specific biome types to create diverse and appropriate environments.

#### 1. Standard Seeded Generation

**Used For**: General biomes (Plains, some Forests)

The default generation method uses seeded random hashing to place individual features (trees, rocks, ponds) and paths. It ensures that features do not overlap with the main path and respects collision boundaries.

#### 2. Cellular Automata (Organic Maps)

**Used For**: Caves, Dungeons
**Implementation**: `src/services/cellularAutomataService.ts`

For environments that require natural, cavernous layouts, the system uses a **Cellular Automata (CA)** algorithm.
- **Initialization**: The grid is filled with random noise (walls vs. floors) based on a fill probability.
- **Simulation**: The grid iterates through several steps of simulation. A cell becomes a wall or floor based on the count of its neighbors (Moore neighborhood), naturally smoothing out noise into cohesive cavern structures.
- **Connectivity**: A post-processing step identifies disconnected floor regions (using flood fill) and carves corridors between them to ensure the entire map is traversable.

#### 3. Wave Function Collapse (Structured Maps)

**Used For**: Mountains, Dense Forests, specialized biomes
**Implementation**: `src/services/wfcService.ts`

For environments requiring logical structure or specific adjacency rules, a simplified **Wave Function Collapse (WFC)** algorithm is used.
- **Row-Scanning**: Unlike a full-entropy WFC solver which can be computationally expensive, this implementation uses a row-by-row scan. This trades some flexibility for the speed required to generate maps on the fly during render.
- **Rulesets**: Adjacency constraints are defined in `src/config/wfcRulesets/`. For example, a "mountain base" tile might only be allowed below a "mountain peak" tile.
- **Biome Context**: The generator filters tiles based on the current biome, ensuring that a "Swamp" submap uses swamp-appropriate tiles while falling back to neutral terrain if constraints cannot be met.

### Future Improvements

#### 1. Gradual Biome Transitions

**Status**: Not Implemented

**Concept**: To improve immersion, the system could be enhanced to create smooth, gradual transitions between different biomes. When a player travels from a "plains" world tile to a "forest" world tile, the edge of the new forest submap would contain a few rows of plains terrain.

**Implementation Plan**: This would be an algorithmic enhancement. The `handleMovement` action would be modified to pass the `previousBiomeId` and `entryDirection` to the `useSubmapProceduralData` hook. The rendering logic in `SubmapPane.tsx` would then use this context to "paint" a few rows of the previous biome's visuals onto the edge of the new submap.

#### 2. PixiJS for High-Performance Rendering

**Status**: Planned (Major Refactor)

**Concept**: To drastically improve rendering performance and unlock advanced visual effects (lighting, particles), the current system of rendering hundreds of React `<div>` elements could be replaced with a WebGL-based canvas managed by the **PixiJS library**.

**Implementation Plan**:
1.  Integrate the PixiJS library.
2.  Create a dedicated React component (`SubmapRendererPixi.tsx`) to encapsulate all PixiJS logic.
3.  Refactor `SubmapPane.tsx` to act as a container that manages data and renders the new PixiJS component instead of the DOM-based grid.
