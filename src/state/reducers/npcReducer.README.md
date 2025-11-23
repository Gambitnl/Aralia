# NPC Slice Reducer (`npcReducer.ts`)

## Purpose

The `npcReducer.ts` module contains a "slice" reducer that is responsible for managing the state of NPC memories (`npcMemory` in the `GameState`). This is a key part of the "Living NPC" system, allowing the game to track and update how NPCs feel about, what they know about, and what they want from the player character.

## Core Functionality

The `npcReducer` function takes the full `GameState` and an `AppAction` as input and returns a `Partial<GameState>` containing only the fields it has modified.

It handles actions related to:
*   **`UPDATE_NPC_DISPOSITION`**: Modifies an NPC's `disposition` score towards the player by a certain amount. The score is clamped between -100 and 100.
*   **`ADD_NPC_KNOWN_FACT`**: Adds a new string (a "fact") to an NPC's `knownFacts` array, ensuring no duplicate facts are added.
*   **`UPDATE_NPC_SUSPICION`**: Sets an NPC's `suspicion` level to a new value (`Unaware`, `Suspicious`, or `Alert`).
*   **`UPDATE_NPC_GOAL_STATUS`**: Updates the `status` of a specific `Goal` within an NPC's `goals` array to `Active`, `Completed`, or `Failed`. This is the core action for progressing an NPC's motivations.

### Immutable Updates
All state updates are performed immutably, creating new objects and arrays for the `npcMemory` slice to ensure predictable state transitions.

## Usage

This reducer is imported and used by the root reducer in `src/state/appState.ts`. It is not intended to be used directly by components.
