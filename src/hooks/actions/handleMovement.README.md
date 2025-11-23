
# Movement Action Handler (`handleMovement.ts`)

## Purpose

The `handleMovement` function is a specialized action handler responsible for processing all player `move` actions. This includes both micro-level movement between adjacent submap tiles and macro-level travel between different world map tiles or named locations.

## Function Signature

```typescript
async function handleMovement(props: HandleMovementProps): Promise<void>;

interface HandleMovementProps {
  action: Action;
  gameState: GameState;
  dispatch: React.Dispatch<AppAction>;
  addMessage: AddMessageFn;
  addGeminiLog: AddGeminiLogFn;
  logDiscovery: LogDiscoveryFn;
  getTileTooltipText: GetTileTooltipTextFn;
  playerContext: string;
}
```

## Core Functionality

1.  **Input Validation**: Checks if the `action.targetId` and other necessary game state properties (like `subMapCoordinates` and `mapData`) are present.
2.  **Movement Type Determination**:
    *   **Named Exits**: If the `targetId` corresponds to a predefined location ID (e.g., "ancient_ruins_entrance"), it handles the transition to that specific location.
    *   **Compass Directions**: If the `targetId` is a compass direction (e.g., "North," "SouthEast"), it calculates the new coordinates.
3.  **Coordinate Calculation & Boundary Checks**:
    *   **Submap Movement**: If the new coordinates are within the current submap's bounds, it updates the player's `subMapCoordinates`.
    *   **World Map Transition**: If the movement crosses the edge of the submap, it calculates the new parent world map coordinates. It checks if the target world map tile is valid and passable before allowing the transition.
4.  **State Updates**:
    *   Dispatches the `MOVE_PLAYER` action with the new location ID, submap coordinates, and updated map data (showing newly discovered/current tiles).
    *   Dispatches an `ADVANCE_TIME` action. The amount of time advanced depends on the type of movement (e.g., 30 minutes for a submap move, 1 hour for a world map move).
5.  **Description Generation**:
    *   Calls the appropriate `GeminiService` function (`generateLocationDescription` for named locations, `generateWildernessLocationDescription` for wilderness tiles) to get a new description for the destination.
    *   Logs the Gemini interaction.
    *   Adds the new description to the game log.
6.  **Discovery Logging**: If the player moves to a new named `Location`, it calls the `logDiscovery` callback to add an entry to the discovery journal.
7.  **Context Reset**: Resets `geminiGeneratedActions` to `null` to ensure the action pane is cleared for the new location.

## Dependencies
*   `geminiService.ts`: For generating location descriptions.
*   `locationUtils.ts`: For determining dynamic NPCs at the new location.
*   `../constants.ts`: For `DIRECTION_VECTORS`, `SUBMAP_DIMENSIONS`, `LOCATIONS`, etc.
*   `actionHandlerTypes.ts`: For shared function signature types.
