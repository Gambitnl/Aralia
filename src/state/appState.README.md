
# App State Module (`src/state/appState.ts`)

## Purpose

The `src/state/appState.ts` module centralizes the core state management logic for the main `App.tsx` component. After a significant refactor, it now serves as the **root reducer**. Its primary responsibilities are:

1.  **Defining Initial State**: It defines the `initialGameState`, the default starting state for the entire application.
2.  **Orchestrating Slice Reducers**: It imports and composes multiple "slice" reducers (`uiReducer`, `characterReducer`, etc.), each responsible for a specific domain of the `GameState`.
3.  **Handling Cross-Cutting Actions**: It directly handles actions that have cross-cutting concerns or affect multiple state domains simultaneously. These include major state transitions like `START_GAME_SUCCESS`, `LOAD_GAME_SUCCESS`, and `MOVE_PLAYER`.
4.  **Delegating Actions**: For all other actions, it delegates the state update logic to the appropriate slice reducer, combining their partial state updates into the final new state.

This separation of concerns makes the state logic more modular, maintainable, and scalable.

## Structure

### `initialGameState`
An object of type `GameState` that represents the default starting state of the application.

### `appReducer` (Root Reducer)
A pure function that implements all state transition logic.
*   It takes the `currentState` and an `action` as input.
*   A top-level `switch` statement handles the cross-cutting actions directly.
*   For all other actions, it calls each slice reducer in sequence, spreading their returned partial state objects onto the new state. This allows each slice to handle the actions relevant to it without interfering with others.

## Usage

*   **`App.tsx`**: Imports `appReducer` and `initialGameState` and uses them with the `useReducer` hook to manage the application's state.

## Dependencies
*   `../types.ts`: For core game types.
*   `./actionTypes.ts`: For the `AppAction` discriminated union type.
*   `../constants.ts`: For initial state values.
*   `../services/saveLoadService.ts`: For initial phase determination.
*   `../utils/*`: For utility functions used in handling cross-cutting actions.
*   All slice reducer files from `src/state/reducers/`.
