# Action Handler Type Definitions (`src/hooks/actions/actionHandlerTypes.ts`)

## Purpose

The `actionHandlerTypes.ts` file serves as a centralized module for defining common TypeScript function signature types used across all modular action handlers. By defining these types in one place, we ensure consistency, improve type safety, and make the dependencies of each action handler explicit and clear.

This prevents the need to redefine complex function signatures in multiple files and makes refactoring easier.

## Exported Types

This module exports the following function signature types:

*   **`AddMessageFn`**:
    *   **Signature**: `(text: string, sender?: 'system' | 'player' | 'npc') => void;`
    *   **Purpose**: A function that adds a new message to the main game log.

*   **`PlayPcmAudioFn`**:
    *   **Signature**: `(base64PcmData: string) => Promise<void>;`
    *   **Purpose**: A function that plays raw PCM audio data, typically used for Text-to-Speech (TTS) output.

*   **`AddGeminiLogFn`**:
    *   **Signature**: `(functionName: string, prompt: string, response: string) => void;`
    *   **Purpose**: A function that adds a new entry to the Gemini API interaction log for debugging purposes.

*   **`LogDiscoveryFn`**:
    *   **Signature**: `(newLocation: Location) => void;`
    *   **Purpose**: A function to log the discovery of a new named location in the player's journal.

*   **`GetTileTooltipTextFn`**:
    *   **Signature**: `(worldMapTile: MapTile) => string;`
    *   **Purpose**: A utility function that generates descriptive tooltip text for a given world map tile.

*   **`GetCurrentLocationFn`**:
    *   **Signature**: `() => Location;`
    *   **Purpose**: A utility function that returns the `Location` object for the player's current position.

*   **`GetCurrentNPCsFn`**:
    *   **Signature**: `() => NPC[];`
    *   **Purpose**: A utility function that returns an array of `NPC` objects present in the player's current location.

## Usage

These types are imported by the main `useGameActions.