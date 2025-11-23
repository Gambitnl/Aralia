
# World Slice Reducer (`worldReducer.ts`)

## Purpose

The `worldReducer.ts` module contains a "slice" reducer that is responsible for managing state changes related to the game world itself. This includes the world map, NPC interaction context, and the passage of in-game time.

## Core Functionality

The `worldReducer` function takes the full `GameState` and an `AppAction` as input and returns a `Partial<GameState>` containing only the fields it has modified.

It handles actions related to:
*   **Map State**:
    *   `SET_MAP_DATA`: Sets the initial `mapData` for the game world.
    *   `UPDATE_INSPECTED_TILE_DESCRIPTION`: Saves a Gemini-generated description for a specific submap tile, making it persistent for the player's journal and future tooltips.
*   **NPC Interaction Context**:
    *   `SET_LAST_NPC_INTERACTION`: "Remembers" the last NPC the player spoke to and what they said, allowing for more contextual follow-up conversations.
    *   `RESET_NPC_INTERACTION_CONTEXT`: Clears the NPC interaction memory when the player performs an unrelated action.
*   **AI-Suggested Actions**:
    *   `SET_GEMINI_ACTIONS`: Updates the list of custom, contextual actions suggested by the AI to be displayed in the `ActionPane`.
*   **Game Time**:
    *   `ADVANCE_TIME`: Increments the in-game clock by a specified number of seconds.

## Usage

This reducer is imported and used by the root reducer in `src/state/appState.ts`. It is not intended to be used directly by components.
