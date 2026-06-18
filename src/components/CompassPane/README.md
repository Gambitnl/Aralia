# CompassPane Component (`src/components/CompassPane/index.tsx`)

## Purpose

The `CompassPane` component provides the 8-directional navigation compass, central "Look Around" button, and navigation affordances for the Aralia RPG. It serves as the primary movement interface for both world map and submap exploration, with context-aware toggle visibility and integrated time management.

## Props

*   **`currentLocation: Location`**:
    *   **Type**: `Location` (from `src/types.ts`)
    *   **Purpose**: The character's current location object. Used for world map coordinate boundary checks and position display.
    *   **Required**: Yes

*   **`currentSubMapCoordinates: { x: number; y: number } | null`**:
    *   **Type**: Object with `x` and `y` number properties, or `null`.
    *   **Purpose**: Player's current coordinates within the submap grid. Essential for movement calculations and position display.
    *   **Required**: Yes (can be `null` when submap navigation is not active).

*   **`worldMapCoords: { x: number; y: number }`**:
    *   **Type**: Object with `x` and `y` number properties.
    *   **Purpose**: Player's current world map coordinates for position display.
    *   **Required**: Yes

*   **`subMapCoords: { x: number; y: number } | null`**:
    *   **Type**: Object with `x` and `y` number properties, or `null`.
    *   **Purpose**: Player's current submap coordinates for position display.
    *   **Required**: Yes

*   **`onAction: (action: Action) => void`**:
    *   **Type**: Function
    *   **Purpose**: Callback function for all compass actions including movement (`move`), observation (`look_around`), UI toggles (`toggle_map`, `toggle_submap_visibility`, `toggle_three_d`), and time management (`wait`).
    *   **Required**: Yes

*   **`disabled: boolean`**:
    *   **Type**: `boolean`
    *   **Purpose**: Global disable state for all compass buttons during loading or processing states.
    *   **Required**: Yes

*   **`mapData: MapData | null`**:
    *   **Type**: `MapData` (from `src/types.ts`) or `null`.
    *   **Purpose**: Complete world map data for boundary and passability checks when moving between world tiles.
    *   **Required**: Yes (can be `null` with reduced movement validation).

*   **`gameTime: Date`**:
    *   **Type**: `Date` object.
    *   **Purpose**: Current in-game time passed to `TimeWidget` for display and pass-time functionality.
    *   **Required**: Yes

*   **`isSubmapContext?: boolean`** (Optional):
    *   **Type**: `boolean`
    *   **Purpose**: Controls context-aware toggle visibility. When `true`, hides submap and 3D toggles to avoid redundancy in submap modal context.
    *   **Required**: No (defaults to `false`)

## Core Functionality

1.  **Time Management**:
    *   Renders `TimeWidget` component with current game time display and pass-time button.
    *   Integrates `PassTimeModal` for time advancement functionality.
    *   Dispatches `wait` actions with seconds payload on pass-time confirmation.

2.  **Position Display**:
    *   Shows current world map coordinates and submap coordinates (when available).
    *   Positioned above the compass grid for quick reference.

3.  **Compass Grid Navigation**:
    *   Renders 3x3 grid with 8 directional buttons plus central "Look Around" (◎) button.
    *   Layout defined by `compassLayout` constant with grid positioning classes.
    *   Uses Framer Motion animations for interactive feedback.

4.  **Action Dispatch**:
    *   **Movement**: Creates `move` actions with `targetId` set to direction key and `payload.query`.
    *   **Observation**: Creates `look_around` actions from center button.
    *   **UI Toggles**: Dispatches `toggle_map`, `toggle_submap_visibility`, and `toggle_three_d` actions.
    *   **Time Management**: Handles `wait` actions through pass-time modal integration.

5.  **Context-Aware Navigation Toggles**:
    *   **World Map Toggle** (🌍): Always visible in all contexts.
    *   **Submap Toggle** (🗺️): Visible only when `isSubmapContext` is `false`.
    *   **3D Toggle** (🎥): Visible only when `isSubmapContext` is `false`.
    *   Uses tooltip components for accessibility and user guidance.

6.  **Smart Button Disabling Logic**:
    *   Global `disabled` prop affects all buttons.
    *   **Look Around**: Never disabled by movement logic.
    *   **Movement buttons** are disabled when:
        *   Target world coordinates are outside map bounds (`mapData.gridSize`).
        *   Target world tile biome is marked as impassable (`BIOMES[biomeId].passable === false`).
    *   **Submap movement**: Always allowed within submap bounds; terrain consequences handled by game logic.

## Integration Context

*   **GameLayout**: Rendered without `isSubmapContext` (defaults to `false`) showing all navigation toggles.
*   **SubmapPane**: Rendered with `isSubmapContext={true}` hiding submap/3D toggles to avoid redundancy.
*   **Action Orchestration**: All actions routed through `useGameActions` hook to appropriate handlers.

## Styling & Accessibility

*   Tailwind CSS styling with dark theme (gray-800 background, sky-400 accents).
*   Comprehensive `aria-label` attributes on all interactive elements.
*   Tooltips provide hover context for toggle buttons.
*   Visual disabled states with cursor and color changes.
*   Framer Motion animations for scale feedback on interaction.

## Data Dependencies

*   `src/types.ts`: `Action`, `Location`, `MapData` type definitions.
*   `src/constants.ts`: `BIOMES` for passability checks.
*   `src/config/mapConfig.ts`: `DIRECTION_VECTORS`, `SUBMAP_DIMENSIONS` for movement calculations.
*   `src/components/ui/TimeWidget.tsx`: Time display and pass-time integration.
*   `src/components/Town/PassTimeModal.tsx`: Time advancement modal.
*   `src/components/ui/Tooltip.tsx`: Hover context for navigation toggles.
*   `src/styles/uiIds.ts`: Component ID constants for testing and styling.
