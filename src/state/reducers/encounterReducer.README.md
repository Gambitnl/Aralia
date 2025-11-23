
# Encounter Slice Reducer (`encounterReducer.ts`)

## Purpose

The `encounterReducer.ts` module contains a "slice" reducer that is responsible for managing state changes related to the procedural encounter generation feature. It handles the lifecycle of an encounter generation request, from initiation to displaying the results in a modal.

## Core Functionality

The `encounterReducer` function takes the full `GameState` and an `AppAction` as input and returns a `Partial<GameState>` containing only the fields it has modified.

It handles actions related to:
*   **`GENERATE_ENCOUNTER`**:
    *   Sets the global `isLoading` state to `true`.
    *   Sets a specific `loadingMessage` related to encounter generation.
    *   Clears any previous encounter data (`generatedEncounter`, `encounterSources`, `encounterError`) to prepare for a new result.
*   **`SHOW_ENCOUNTER_MODAL`**:
    *   Sets `isLoading` to `false`.
    *   Sets `isEncounterModalVisible` to `true` to display the modal.
    *   Populates the state with the encounter data (or an error message) received in the action's payload.
    *   Updates the `tempParty` state to reflect the party composition that was used for the generation, providing context to the player.
*   **`HIDE_ENCOUNTER_MODAL`**:
    *   Sets `isEncounterModalVisible` to `false` to hide the modal.
    *   Clears the encounter data from the state.

## Usage

This reducer is imported and used by the root reducer in `src/state/appState.ts`. It is not intended to be used directly by components.
