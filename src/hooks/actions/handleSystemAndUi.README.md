
# System and UI Action Handlers (`handleSystemAndUi.ts`)

## Purpose

The `handleSystemAndUi.ts` module contains functions for processing actions related to system-level operations (like saving the game) and toggling the visibility of major UI panes and modals.

## Functions

### `handleSaveGame(props)`

*   **Purpose**: Manages the `save_game` action.
*   **Logic**:
    1.  Dispatches `SET_LOADING` to show a "Saving..." message.
    2.  Calls `SaveLoadService.saveGame()` with the current game state.
    3.  Adds a success or failure message to the game log based on the result.
    4.  Dispatches `SET_LOADING` again to hide the loading spinner.

### `handleGoToMainMenu(props)`

*   **Purpose**: Manages the `go_to_main_menu` action.
*   **Logic**:
    1.  If not in developer dummy mode, it first calls `handleSaveGame` to ensure progress is saved before exiting.
    2.  Dispatches `SET_GAME_PHASE` to `GamePhase.MAIN_MENU`, which triggers a UI state reset in the reducer.

### UI Toggle Functions
*   `handleToggleMap(dispatch)`
*   `handleToggleSubmap(dispatch)`
*   `handleToggleDevMenu(dispatch)`
*   `handleToggleDiscoveryLog(dispatch)`
*   `handleTogglePartyEditor(dispatch)`
*   `handleTogglePartyOverlay(dispatch)`

*   **Purpose**: These are simple, synchronous functions that dispatch their respective toggle actions (e.g., `TOGGLE_MAP_VISIBILITY`). The reducer then handles changing the visibility flag and ensuring other conflicting modals are closed.

### `handleToggleGlossary(dispatch, initialTermId?)`

*   **Purpose**: Dispatches the `TOGGLE_GLOSSARY_VISIBILITY` action.
*   **Logic**: This handler can optionally receive an `initialTermId`. It passes this ID in the action's payload, allowing the `Glossary` component to open directly to a specific entry. The reducer handles setting this value in the state.

## Design Philosophy

These handlers provide a clean and organized way to trigger system and UI state changes. They encapsulate any multi-step logic (like save-then-exit) and ensure that UI toggles correctly reset other interaction contexts via the reducer.

## Dependencies
*   `../state/appState.ts`: For `AppAction` and `GamePhase` types.
*   `../services/saveLoadService.ts`: For game saving.
*   `../constants.ts`: For `USE_DUMMY_CHARACTER_FOR_DEV`.
*   `actionHandlerTypes.ts`: For `AddMessageFn`.
