
# Log Slice Reducer (`logReducer.ts`)

## Purpose

The `logReducer.ts` module contains a "slice" reducer that is responsible for managing all state changes related to the various logs within the application. This includes the main game log, the developer-focused Gemini API log, and the player's discovery journal.

## Core Functionality

The `logReducer` function takes the full `GameState` and an `AppAction` as input and returns a `Partial<GameState>` containing only the fields it has modified.

It handles actions related to:
*   **Main Game Log**:
    *   `ADD_MESSAGE`: Appends a new `GameMessage` to the `messages` array displayed in the `WorldPane`.
*   **Developer Log**:
    *   `ADD_GEMINI_LOG_ENTRY`: Prepends a new `GeminiLogEntry` to the `geminiInteractionLog` array, which is used by the `GeminiLogViewer` component. It also trims the log to a maximum size (e.g., 100 entries) to prevent excessive memory usage.
*   **Discovery Journal**:
    *   `ADD_DISCOVERY_ENTRY`: Adds a new `DiscoveryEntry` to the `discoveryLog` and increments the `unreadDiscoveryCount`. It includes logic to prevent duplicate entries for the same location discovery.
    *   `MARK_DISCOVERY_READ`: Sets the `isRead` flag to `true` for a specific journal entry and decrements the `unreadDiscoveryCount`.
    *   `MARK_ALL_DISCOVERIES_READ`: Sets the `isRead` flag to `true` for all entries and resets the `unreadDiscoveryCount` to 0.
    *   `CLEAR_DISCOVERY_LOG`: Clears all entries from the journal.
    *   `UPDATE_QUEST_IN_DISCOVERY_LOG`: Updates an existing quest-related entry with new information and marks it as unread.

## Usage

This reducer is imported and used by the root reducer in `src/state/appState.ts`. It is not intended to be used directly by components.
