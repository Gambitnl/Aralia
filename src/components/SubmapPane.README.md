# SubmapPane Component (`src/components/SubmapPane.tsx`)

## Purpose

The `SubmapPane.tsx` component is responsible for rendering a visual representation of the player's immediate surroundings at a granular level. It displays a grid (default 25x25, defined by `submapDimensions`) representing the sub-tiles within the player's current world map tile. This enhances the player's spatial awareness and immersion during exploration by providing a more detailed, "zoomed-in" view.

Key features include:
*   **Procedural Data Generation**: Uses the `useSubmapProceduralData` custom hook to manage the generation of tile hashing logic, seeded feature placement (micro-locales), and path details.
*   Vastly expanded visual variety through procedurally generated feature "clumping".
*   Simple visual paths with adjacency effects.
*   A rich palette of icons and colors.
*   A modal-based icon glossary/legend to explain submap symbols.
*   Unique submap generation per world map tile.
*   **Contextual Tile Tooltips**: Each submap tile now has a tooltip with hints that become more detailed post-inspection.
*   **Tile Inspection**: An "Inspect Tile" mode allows players to get detailed, AI-generated descriptions of adjacent tiles.
*   **Compass Integration**: The `CompassPane` is now rendered directly within this component, providing a unified local navigation experience.

## Configuration

The visual appearance of each biome (base colors, path styles, scatter features, etc.) is not hardcoded within this component. It is defined in a dedicated configuration file: **`src/config/submapVisualsConfig.ts`**. This separation of concerns allows for easier tuning of the submap's aesthetic without modifying the component's rendering logic.

## Props

*   **`currentLocation: Location`**: The current location object, used for context and coordinates.
*   **`currentWorldBiomeId: string`**: The ID of the biome for the current world map tile.
*   **`playerSubmapCoords: { x: number; y: number }`**: The player's current coordinates within the submap grid.
*   **`onClose: () => void`**: A callback function invoked when the player closes the submap.
*   **`submapDimensions: { rows: number; cols: number }`**: The dimensions of the submap grid.
*   **`parentWorldMapCoords: { x: number; y: number }`**: The coordinates of the parent world map tile.
*   **`onAction: (action: Action) => void`**: Callback to dispatch game actions.
*   **`disabled: boolean`**: Indicates if actions should be disabled.
*   **`inspectedTileDescriptions: Record<string, string>`**: A map of previously inspected tile descriptions.
*   **`mapData: MapData | null`**: The full world map data for context.
*   **`gameTime: Date`**: The current in-game time.

## Core Functionality

1.  **Modal Display**: Renders as a fixed-position overlay.
2.  **Grid Rendering**: Generates a 2D grid of `div` elements, each wrapped by a `Tooltip`.
3.  **Procedural Data Generation**: Uses the `useSubmapProceduralData` hook for all procedural data.
4.  **Advanced Tile Styling**: The `getTileVisuals` function and its sub-functions (`getBaseVisuals`, `applyPathVisuals`, etc.) orchestrate the visual appearance of each tile based on the configuration in `submapVisualsConfig.ts`.
5.  **Tooltip Generation**: The `getHintForTile` function generates contextual tooltips, prioritizing persistent inspected descriptions over default hints.
6.  **Tile Inspection Mode**: A button toggles `isInspecting` state.
7.  **Glossary/Legend**: A "Show Legend" button opens a modal displaying the submap legend.
8.  **Compass Integration**: Renders the `CompassPane` for local navigation.

## Data Dependencies

*   `src/types.ts`: Core type definitions.
*   `src/constants.ts`: For `BIOMES`.
*   `src/config/mapConfig.ts`: For `SUBMAP_DIMENSIONS`.
*   **`src/config/submapVisualsConfig.ts`**: For all biome visual definitions.
*   `src/data/glossaryData.ts`: For `SUBMAP_ICON_MEANINGS`.
*   `src/components/GlossaryDisplay.tsx` and `src/components/Tooltip.tsx`.
*   `src/hooks/useSubmapProceduralData.ts`: For procedural data generation.
