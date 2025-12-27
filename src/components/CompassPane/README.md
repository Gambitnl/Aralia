# CompassPane Component (`src/components/CompassPane.tsx`)

## Purpose

The `CompassPane.tsx` component is dedicated to rendering the 8-directional navigation compass and the central "Look Around" button for the Aralia RPG. It provides the primary means for player movement within submap tiles and between world map tiles, as well as initiating a general observation of the surroundings. **It now also displays the player's current world and submap coordinates, and the current game time (formatted as HH:MM:SS AM/PM), which automatically advances second by second during active gameplay.**

## Props

*   **`currentLocation: Location`**:
    *   **Type**: `Location` (from `src/types.ts`)
    *   **Purpose**: The character's current location object. Used to determine the player's world map coordinates for boundary checks and for the "Current Position" display.
    *   **Required**: Yes

*   **`currentSubMapCoordinates: { x: number; y: number } | null`**:
    *   **Type**: Object with `x` and `y` number properties, or `null`.
    *   **Purpose**: The player's current coordinates within the submap grid of the `currentLocation`. Essential for calculating movement within the submap and for the "Current Position" display.
    *   **Required**: Yes (can be `null` if the player is not in a state where submap navigation is active).

*   **`worldMapCoords: { x: number; y: number }`**:
    *   **Type**: Object with `x` and `y` number properties.
    *   **Purpose**: The player's current world map coordinates, explicitly for the "Current Position" display.
    *   **Required**: Yes

*   **`subMapCoords: { x: number; y: number } | null`**:
    *   **Type**: Object with `x` and `y` number properties, or `null`.
    *   **Purpose**: The player's current submap coordinates, explicitly for the "Current Position" display.
    *   **Required**: Yes

*   **`onAction: (action: Action) => void`**:
    *   **Type**: Function
    *   **Purpose**: A callback function invoked when any compass button (including "Look Around") is clicked. It passes the corresponding `Action` object (`type: 'move'` with `targetId` as direction, or `type: 'look_around'`).
    *   **Required**: Yes

*   **`disabled: boolean`**:
    *   **Type**: `boolean`
    *   **Purpose**: If `true`, all compass buttons are disabled. This is used when another action is being processed or the game is in a loading state.
    *   **Required**: Yes

*   **`mapData: MapData | null`**:
    *   **Type**: `MapData` (from `src/types.ts`) or `null`.
    *   **Purpose**: The complete world map data. Used to check the passability of adjacent world map tiles when the player attempts to move off the edge of the current submap.
    *   **Required**: Yes (can be `null`, in which case movement to adjacent world tiles might be disabled or handled less accurately).

*   **`gameTime: Date`**:
    *   **Type**: `Date` object.
    *   **Purpose**: The current in-game time. Used to display the time below the compass. **The displayed time now includes seconds and updates automatically.**
    *   **Required**: Yes

## Core Functionality

1.  **Current Position & Time Display**:
    *   Shows the player's current world map coordinates (`worldMapCoords`) and submap coordinates (`subMapCoords`) at the top of the pane.
    *   Displays the current `gameTime`, formatted to HH:MM:SS AM/PM, below the compass grid. **This clock now ticks forward second by second during active gameplay.**

2.  **Compass Grid Rendering**:
    *   Displays a 3x3 grid of buttons representing North-West, North, North-East, West, East, South-West, South, South-East, and a central "Look Around" (◎) button.
    *   The layout is defined by the `compassLayout` constant.

3.  **Action Dispatch**:
    *   Clicking a directional button creates a `move` action with the `targetId` set to the direction key (e.g., "North", "SouthEast").
    *   Clicking the "Look Around" button creates a `look_around` action.
    *   The generated action is then passed to the `onAction` prop.

4.  **Button Disabling Logic (`isCompassActionDisabled`)**:
    *   A button is disabled if the global `disabled` prop is `true`.
    *   The "Look Around" button is generally not disabled by movement logic.
    *   Movement buttons are disabled if:
        *   The player is trying to move off the edge of the world map (i.e., `targetWorldMapX` or `targetWorldMapY` are out of `mapData.gridSize` bounds).
        *   The player is trying to move to an adjacent world map tile whose biome is marked as impassable (e.g., `BIOMES[targetBiomeId].passable === false`).
    *   Movement within the current submap's boundaries is always considered valid by this component; the consequences of moving onto different terrain within the submap are handled by the game logic responding to the action.

## Styling
*   Uses Tailwind CSS for styling the pane and buttons.
*   The pane is compact, designed to fit the compass grid and the current position/time text.
*   Buttons have distinct styling for active and disabled states.
*   The central "Look Around" button has a larger icon.

## Layout
The `CompassPane` is typically displayed as part of the main interaction area in `App.tsx`, arranged **horizontally alongside** `ActionPane`. It takes up only the width necessary for its content.

## Accessibility
*   Each button has a clear `aria-label` indicating its action (e.g., "Move North", "Look Around").
*   Disabled states are visually and programmatically indicated.
*   Tooltips (`title` attribute) mirror the `aria-label` for hover information.

## Data Dependencies
*   `src/types.ts`: For `Action`, `Location`, `MapData` types.
*   `src/constants.ts`: For `BIOMES`, `DIRECTION_VECTORS`, `SUBMAP_DIMENSIONS`.
