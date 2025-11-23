# MapPane Component (`src/components/MapPane.tsx`)

## Purpose

The `MapPane.tsx` component is responsible for rendering the game's world map as a visual overlay. It allows players to see discovered areas, their current position, and the biomes of different regions. Players can interact with the map by clicking on discovered tiles to potentially travel to linked locations. It now features enhanced keyboard navigation and an icon glossary.

## Props

*   **`mapData: MapData`**:
    *   **Type**: `MapData` (from `src/types.ts`)
    *   **Purpose**: The core data object representing the map, including `gridSize` (rows, cols) and the 2D array of `MapTile` objects.
    *   **Required**: Yes

*   **`onTileClick: (x: number, y: number, tile: MapTile) => void`**:
    *   **Type**: Function
    *   **Purpose**: A callback function invoked when the player clicks on a map tile or activates it via keyboard (Enter/Space). It receives the `x`, `y` coordinates of the clicked tile and the `MapTile` object itself.
    *   **Required**: Yes

*   **`onClose: () => void`**:
    *   **Type**: Function
    *   **Purpose**: A callback function invoked when the player clicks the "Close Map" button or presses the Escape key. This is used to hide the map overlay.
    *   **Required**: Yes

## Core Functionality

1.  **Modal Display**:
    *   Renders as a fixed-position overlay covering the screen.
    *   The map itself is contained within a styled panel with a parchment paper-like texture.

2.  **Grid Rendering**:
    *   Uses CSS Grid to display map tiles.
    *   Each tile is a button.

3.  **Tile Styling (`getTileStyle`)**:
    *   **Discovered Tiles**: Background color based on biome, displays biome icon.
    *   **Undiscovered Tiles**: "Fog of war" appearance with a "?".
    *   **Player's Current Tile**: Highlighted with a distinct border and a "📍" emoji.

4.  **Interaction**:
    *   **Mouse**: Clicking a clickable tile calls `onTileClick`.
    *   **Keyboard (Roving Tabindex & Arrow Keys)**:
        *   The "Close" button is focused initially when the map opens.
        *   Users can Tab from the close button to the map grid. When the grid (or specifically, the first focusable tile) receives focus, arrow keys can be used.
        *   **Arrow Keys (Up, Down, Left, Right)**: Move focus between map tiles. The `focusedCoords` state tracks the currently focused tile.
        *   **Enter or Space**: When a tile is focused, pressing Enter or Space activates it (calls `onTileClick` if the tile is clickable).
        *   **Tab**: Only the currently "arrow-focused" tile (or the close button) is part of the Tab order. Tabbing out of the grid will move focus away from the map tiles.
        *   **Escape Key**: Closes the map pane (calls `onClose`).
    *   The "Close Map" button calls `onClose`.

5.  **State Management (Internal)**:
    *   `focusedCoords: { x: number; y: number } | null`: Tracks the coordinates of the tile that currently has keyboard focus within the grid. Initialized to the player's current tile.

6.  **Glossary/Legend**:
    *   Integrates the `GlossaryDisplay` component.
    *   Dynamically collects icons from `BIOMES` and predefined map markers (player location, undiscovered area) to populate `mapGlossaryItems`.
    *   Renders the `GlossaryDisplay` below the map grid, providing a legend for the icons used.

## Styling

*   Uses Tailwind CSS.
*   Parchment paper background for the map container.
*   Dynamic tile background colors.
*   Focus states are visually indicated (e.g., `ring-sky-400`).

## Accessibility

*   The map pane modal has `aria-modal="true"`, `role="dialog"`, and `aria-labelledby`.
*   The close button has an `aria-label` and is focused initially.
*   Each map tile button:
    *   Has `role="gridcell"`.
    *   Has an `aria-label` describing its state (biome, coordinates, location name if any, current location status, focused status).
    *   Has `aria-selected={isFocused}` to indicate keyboard focus.
    *   Uses `tabIndex` for the roving tabindex implementation (`0` for the active/focused tile, `-1` for others).
*   Biome icons have `role="img"` and `aria-label`.
*   Disabled states for undiscovered/unclickable tiles prevent interaction and are visually distinct.
*   Keyboard navigation instructions are provided at the bottom of the map.

## Data Dependencies

*   **`MapData`, `MapTile`, `Biome`, `GlossaryItem` types** (from `src/types.ts`).
*   **`BIOMES` constant** (from `src/constants.ts`).
*   **`LOCATIONS` constant** (from `src/constants.ts`).
*   **`GlossaryDisplay` component** (from `./GlossaryDisplay.tsx`).

## Future Considerations

*   Support for map panning and zooming for larger maps.
*   More sophisticated visual representation of biomes.
*   Displaying points of interest or quest markers.