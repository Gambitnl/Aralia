
# Observation Action Handlers (`handleObservation.ts`)

## Purpose

The `handleObservation.ts` module contains functions for processing player actions related to observing their environment. This includes general "look around" actions and specific "inspect tile" actions on the submap.

## Functions

### `handleLookAround(props: HandleLookAroundProps): Promise<void>`

*   **Purpose**: Manages the `look_around` action. This function is responsible for generating a more detailed description of the player's immediate surroundings and then using that description to generate a new set of contextual, AI-suggested custom actions.
*   **Interface**:
    ```typescript
    interface HandleLookAroundProps {
      gameState: GameState;
      dispatch: React.Dispatch<AppAction>;
      addMessage: AddMessageFn;
      addGeminiLog: AddGeminiLogFn;
      generalActionContext: string;
      getTileTooltipText: GetTileTooltipTextFn;
    }
    ```
*   **Logic**:
    1.  Calls `GeminiService.generateActionOutcome` to get a rich, 2-3 sentence description of the area.
    2.  Logs this interaction and adds the description to the game log.
    3.  Feeds the new description into `GeminiService.generateCustomActions` to get a fresh set of context-aware player choices.
    4.  Logs the custom action generation interaction.
    5.  Filters out any suggested actions that are simple compass directions to avoid redundancy with the main navigation UI.
    6.  Dispatches `SET_GEMINI_ACTIONS` with the new, filtered list of actions, which updates the `ActionPane`.

### `handleInspectSubmapTile(props: HandleInspectSubmapTileProps): Promise<void>`

*   **Purpose**: Handles the `inspect_submap_tile` action, which is triggered when the player is in the `SubmapPane`'s "Inspect Mode" and clicks an adjacent tile.
*   **Interface**:
    ```typescript
    interface HandleInspectSubmapTileProps {
      action: Action;
      gameState: GameState;
      dispatch: React.Dispatch<AppAction>;
      addMessage: AddMessageFn;
      addGeminiLog: AddGeminiLogFn;
    }
    ```
*   **Logic**:
    1.  Validates the action payload to ensure it contains the necessary `inspectTileDetails`.
    2.  Calls `GeminiService.generateTileInspectionDetails` with a detailed prompt, including character context, game time, biome info, and specific feature details. The prompt explicitly instructs the AI to avoid game jargon.
    3.  Logs the Gemini interaction.
    4.  Adds the resulting description to the game log for the player to see.
    5.  Dispatches `UPDATE_INSPECTED_TILE_DESCRIPTION` to save this new, detailed description to the game state. This makes the description persistent, appearing in that tile's tooltip on subsequent views of the submap.
    6.  Dispatches `ADVANCE_TIME` to simulate the time taken for the inspection.
    7.  Resets other interaction contexts (`geminiGeneratedActions`, `lastInteractedNpcId`).

## Dependencies
*   `geminiService.ts`: For all AI interactions.
*   `actionHandlerTypes.ts`: For shared function signature types.
*   `../constants.ts`: For `DIRECTION_VECTORS` (used for filtering).
