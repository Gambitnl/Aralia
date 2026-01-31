# App Component (`src/App.tsx`)

## Purpose

The `App.tsx` component is the root React component for the Aralia RPG. It serves as the central hub for managing the overall game state, orchestrating UI changes based on game phases, handling user actions, and interacting with various services. It has been refactored to delegate significant portions of its logic to custom hooks and a centralized state module for better organization and maintainability.

## State Management (`gameState` with `useReducer`)

The `App` component manages a comprehensive `gameState` object using the `useReducer` hook. The reducer logic (`appReducer`) is defined in **`src/state/appState.ts`**, and the initial state (`initialGameState`) is defined in **`src/state/initialState.ts`**. Action types (`AppAction`) are defined in **`src/state/actionTypes.ts`**.

The `gameState` (defined in `src/types.ts`) includes:
*   Party composition, inventory, location, submap coordinates.
*   Game messages, loading/error states.
*   World map data, map/submap visibility flags.
*   Dynamic item states and Gemini-generated custom actions.
*   **Character Sheet Modal State**: `characterSheetModal: { isOpen: boolean; character: PlayerCharacter | null; }` for managing the visibility and content of the character details modal.
*   Save game version and timestamp (when loaded).
*   **`gameTime: Date`**: The current in-game time. This clock now advances automatically per second during active gameplay, in addition to manual advancements from specific player actions.
*   **Developer Mode State**:
    *   `isDevMenuVisible: boolean`: Controls the visibility of the Developer Menu modal.
    *   `isGeminiLogViewerVisible: boolean`: Controls the visibility of the Gemini API Log Viewer modal.
    *   `geminiInteractionLog: GeminiLogEntry[]`: An array storing recent Gemini API interaction logs (prompt, response, timestamp, function name).
*   **Party Overlay State**: `isPartyOverlayVisible: boolean`.

## Core Functionality (Orchestrated via Hooks)

1.  **Game Phase Management**:
    *   Renders different UI views (`MainMenu`, `CharacterCreator`, main game interface) based on `gameState.phase`.
    *   Transitions between phases by dispatching actions to `appReducer`.

2.  **Game Initialization (via `useGameInitialization` hook)**:
    *   The `useGameInitialization` hook provides memoized callbacks for new games, loading games, and starting the game post-character creation.
    *   `App.tsx` calls these functions based on user interaction or initial load conditions.

3.  **Action Processing (via `useGameActions` hook)**:
    *   The `useGameActions` hook provides a memoized `processAction` callback.
    *   This callback is passed to UI components like `ActionPane` and `CompassPane` to handle all player actions.
    *   The complex logic for each action type is encapsulated within modular action handlers in the `src/hooks/actions/` directory, making `useGameActions` a lean orchestrator.

4.  **Audio Management (via `useAudio` hook)**:
    *   The `useAudio` hook provides `playPcmAudio` for TTS output and `cleanupAudioContext` for resource management.

5.  **Automatic Game Clock**: An effect in `App.tsx` advances the `gameTime` every second when the UI is active.

6.  **Data Access Utilities**: Internal `useCallback` hooks like `getCurrentLocation` and `getCurrentNPCs` provide stable data access functions for the action hooks.

7.  **UI Modal/Overlay Management**:
    *   Conditionally renders all major overlays (`MapPane`, `SubmapPane`, `CharacterSheetModal`, `PartyOverlay`, `DevMenu`, etc.) based on flags in `gameState`.
    *   Provides callbacks like `handleOpenCharacterSheet` to manage the state for these overlays.

## Data Dependencies & Hooks

*   `src/state/appState.ts`: For `appReducer`.
*   `src/state/initialState.ts`: For `initialGameState`.
*   `src/hooks/useAudio.ts`: For audio playback.
*   `src/hooks/useGameActions.ts`: For processing player actions.
*   `src/hooks/useGameInitialization.ts`: For game setup and loading.
*   `../types.ts`: Core type definitions including `GeminiLogEntry`.
*   `../constants.ts`: Game constants and aggregated static data.
*   Services (indirectly via hooks): `../services/*`.
*   Child UI Components including `CharacterSheetModal.tsx`, `PartyOverlay.tsx`, `DevMenu.tsx`, `GeminiLogViewer.tsx`.