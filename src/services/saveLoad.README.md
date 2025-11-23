
# Save/Load Service (`src/services/saveLoadService.ts`)

## Purpose

The `saveLoadService.ts` module is responsible for all interactions related to saving and loading the game state in Aralia RPG. It abstracts the underlying storage mechanism (currently Local Storage) and provides a clear API for the rest of the application to persist and retrieve game progress.

## Core Functionality

The service exports several key functions:

1.  **`saveGame(gameState: GameState, slotName?: string): Promise<boolean>`**
    *   **Purpose**: Serializes the provided `GameState` object and stores it in Local Storage.
    *   **Parameters**:
        *   `gameState: GameState`: The complete current game state to be saved. This includes `playerCharacter`, `inventory`, `currentLocationId`, `subMapCoordinates`, `messages`, `mapData`, `dynamicLocationItemIds`, etc.
        *   `slotName?: string`: Optional. The name of the save slot. Defaults to `aralia_rpg_default_save`.
    *   **Process**:
        *   Creates a new object by spreading `gameState`.
        *   Sets/updates `saveVersion` (to the current `SAVE_GAME_VERSION` constant) and `saveTimestamp` (to `Date.now()`).
        *   Resets transient UI-related state fields within the object being saved (e.g., `isLoading`, `isImageLoading`, `error`, `isMapVisible`, `isSubmapVisible`, `geminiGeneratedActions`) to ensure a clean state upon loading.
        *   Serializes the modified state object to a JSON string.
        *   Stores the string in `localStorage` under the `slotName`.
        *   Logs success or errors to the console.
        *   Uses `alert` for user-facing error messages (e.g., quota exceeded).
    *   **Returns**: A `Promise` resolving to `true` if saving was successful, `false` otherwise.

2.  **`loadGame(slotName?: string): Promise<GameState | null>`**
    *   **Purpose**: Retrieves and deserializes game state from Local Storage.
    *   **Parameters**:
        *   `slotName?: string`: Optional. The name of the save slot to load from. Defaults to `aralia_rpg_default_save`.
    *   **Process**:
        *   Retrieves the JSON string from `localStorage` using `slotName`.
        *   If no data is found, returns `null`.
        *   Parses the JSON string into a `GameState` object.
        *   **Version Check**: Compares the `saveVersion` in the loaded data with the `SAVE_GAME_VERSION` constant. If they don't match, logs a warning, alerts the user about incompatibility, and returns `null`.
        *   Resets transient UI-related state fields in the loaded state (similar to `saveGame`).
        *   Sets `phase` to `GamePhase.PLAYING`.
        *   Logs success or errors to the console.
        *   Uses `alert` for user-facing error messages (e.g., corrupted data).
    *   **Returns**: A `Promise` resolving to the loaded `GameState` object, or `null` if loading fails or no valid save is found.

3.  **`hasSaveGame(slotName?: string): boolean`**
    *   **Purpose**: Checks if a save game entry exists in the specified Local Storage slot.
    *   **Parameters**:
        *   `slotName?: string`: Optional. The name of the save slot. Defaults to `aralia_rpg_default_save`.
    *   **Returns**: `true` if an item exists for `slotName` in `localStorage`, `false` otherwise.

4.  **`getLatestSaveTimestamp(slotName?: string): number | null`**
    *   **Purpose**: Retrieves the `saveTimestamp` from a saved game.
    *   **Parameters**:
        *   `slotName?: string`: Optional. The name of the save slot. Defaults to `aralia_rpg_default_save`.
    *   **Process**:
        *   Loads the raw string from `localStorage`.
        *   Parses it as JSON (partially, just enough to get the timestamp).
        *   Returns the `saveTimestamp` property if present.
    *   **Returns**: The timestamp (number) or `null` if not found or an error occurs.

5.  **`deleteSaveGame(slotName?: string): void`**
    *   **Purpose**: Removes a save game entry from Local Storage.
    *   **Parameters**:
        *   `slotName?: string`: Optional. The name of the save slot. Defaults to `aralia_rpg_default_save`.
    *   **Process**:
        *   Calls `localStorage.removeItem(slotName)`.
        *   Logs success or errors.

## Constants

*   **`SAVE_GAME_VERSION: string`**: Defines the current version of the save game format (e.g., `"0.1.0"`). This is used for compatibility checks when loading games.
*   **`DEFAULT_SAVE_SLOT: string`**: The default key used for storing the save game in Local Storage (e.g., `"aralia_rpg_default_save"`).

## Storage Mechanism

*   Currently uses **Browser Local Storage**.

## Data Integrity and Versioning

*   The service implements a basic versioning system by storing `saveVersion` within the save data.
*   When loading, it compares this version against the application's current `SAVE_GAME_VERSION`. Mismatches result in the load operation being aborted to prevent errors due to incompatible data structures.

## Usage

The `saveLoadService` is primarily used by:
*   **`App.tsx`**: To trigger save operations (via `saveGame`) and to load game state (via `loadGame`).
*   **`MainMenu.tsx`**: To check for the existence of a save game (`hasSaveGame`) and get its timestamp (`getLatestSaveTimestamp`) for displaying "Continue" options and save details.

## Future Considerations

*   **Multiple Save Slots**: Extend functions to manage different named slots beyond the default.
*   **Migration Logic**: For more complex version changes, implement migration functions to attempt to upgrade older save formats to the current one.
*   **Error Handling**: More sophisticated error handling and user feedback, avoiding `alert()`.
*   **Storage Abstraction**: If a different storage mechanism is desired, the service's internal implementation would change, but its public API could largely remain the same.
