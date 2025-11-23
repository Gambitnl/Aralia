
# MainMenu Component

## Purpose

The `MainMenu.tsx` component renders the main menu screen for the Aralia RPG.
It provides options to start a new game, load a saved game, and view the game **Glossary**.
It also includes a conditional "Skip Character Creator" button for development purposes.

## Props

*   **`onNewGame: () => void`**:
    *   **Type**: Function
    *   **Purpose**: Callback invoked when the "New Game" button is clicked. Typically transitions the game to the character creation phase.
    *   **Required**: Yes

*   **`onLoadGame: () => void`**:
    *   **Type**: Function
    *   **Purpose**: Callback invoked when the "Load Game" or "Continue" button is clicked. Initiates the process of loading a saved game.
    *   **Required**: Yes

*   **`onShowCompendium: () => void`**:
    *   **Type**: Function
    *   **Purpose**: Callback invoked when the "Glossary" button (formerly "Compendium") is clicked. This should toggle the visibility of the `Glossary.tsx` component.
    *   **Required**: Yes

*   **`hasSaveGame: boolean`**:
    *   **Type**: `boolean`
    *   **Purpose**: Indicates if a save game file exists. Used to enable/disable the "Load Game" button and show/hide the "Continue" button.
    *   **Required**: Yes

*   **`latestSaveTimestamp: number | null`**:
    *   **Type**: `number` (timestamp) or `null`
    *   **Purpose**: The timestamp of the most recent save game. Used to display when the game was last played under the "Continue" button.
    *   **Required**: Yes

*   **`isDevDummyActive: boolean`**:
    *   **Type**: `boolean`
    *   **Purpose**: If `true`, a "Skip Character Creator (Dev)" button is displayed, allowing developers to bypass character creation and start with a predefined dummy character.
    *   **Required**: Yes

*   **`onSkipCharacterCreator: () => void`**:
    *   **Type**: Function
    *   **Purpose**: Callback invoked when the "Skip Character Creator (Dev)" button is clicked.
    *   **Required**: Yes

## Core Functionality

1.  **Display**:
    *   Shows the game title "Aralia RPG".
    *   Presents buttons for game actions.

2.  **Button Logic**:
    *   **Continue**: Shown only if `hasSaveGame` is true. Displays `latestSaveTimestamp`. Calls `onLoadGame`.
    *   **New Game**: Always visible. Calls `onNewGame`.
    *   **Skip Character Creator (Dev)**: Shown only if `isDevDummyActive` is true. Calls `onSkipCharacterCreator`.
    *   **Load Game**: Enabled only if `hasSaveGame` is true. Calls `onLoadGame`.
    *   **Glossary**: Always visible. Calls `onShowCompendium` (which toggles the glossary modal).

3.  **Timestamp Formatting**:
    *   A helper function `formatTimestamp` converts the `latestSaveTimestamp` into a user-friendly date and time string.

## Styling

*   Uses Tailwind CSS for a thematic dark fantasy appearance.
*   Buttons are large, clearly labeled, and have hover/focus effects.
*   The game title uses a distinct "Cinzel Decorative" font.

## Accessibility
*   Buttons have `aria-label` attributes for screen readers.
*   The "Load Game" button's `disabled` state and `title` attribute provide context when no save file is present.
*   The "Glossary" button is labeled appropriately.

## Data Dependencies
*   None directly, but interacts with `saveLoadService.ts` indirectly via `hasSaveGame` and `latestSaveTimestamp` props.
*   Relies on the parent component (`App.tsx`) to provide the correct callbacks for actions.
