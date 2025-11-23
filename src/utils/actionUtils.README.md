
# Action Utilities (`src/utils/actionUtils.ts`)

## Purpose

The `actionUtils.ts` module provides utility functions related to player `Action` objects. Its primary purpose is to enhance the game's narrative immersion by translating mechanical action data into user-friendly, diegetic text suitable for the game log.

Instead of displaying a mechanical log entry like `> action:move target:forest_path`, this utility helps generate a more natural message like "You head North."

## Core Functionality

The module exports one key function:

### `getDiegeticPlayerActionMessage(action: Action, gameNpcs: Record<string, NPC>, gameLocations: Record<string, Location>, playerCharacter: PlayerCharacter | undefined): string | null`

*   **Purpose**: Takes a player's `Action` object and generates a human-readable, narrative-style string that describes what the player chose to do.
*   **Parameters**:
    *   `action: Action`: The `Action` object being processed.
    *   `gameNpcs: Record<string, NPC>`: The complete record of all NPCs, used to look up an NPC's name for a "Talk" action.
    *   `gameLocations: Record<string, Location>`: The complete record of all locations, used to look up a location's name for a special "move" action.
    *   `playerCharacter: PlayerCharacter | undefined`: The player character object, used to get details for unequipping items.
*   **Logic**:
    *   It uses a `switch` statement on the `action.type`.
    *   For `move` actions, it checks if the `targetId` is a compass direction (from `DIRECTION_VECTORS`) or a location ID, and formats the message accordingly.
    *   For `talk` and `take_item` actions, it looks up the name of the NPC or item from the provided data records.
    *   For `gemini_custom_action`, it uses the action's `label`.
    *   For UI-only actions like `toggle_map` or `save_game`, it returns `null` because these actions typically don't need a corresponding player log entry.
*   **Returns**:
    *   A `string` representing the diegetic action message (e.g., "You approach the Old Hermit to speak.").
    *   `null` if the action is purely mechanical or UI-related and shouldn't appear in the player's action log.

## Usage

This function is primarily called by the `useGameActions` hook at the beginning of the `processAction` function. The returned string is then immediately sent to the `WorldPane` via `addMessage` to show the player's intent before the action's outcome is processed.

**Example (in `useGameActions.ts`):**
```typescript
// ...
const diegeticMessage = getDiegeticPlayerActionMessage(action, NPCS, LOCATIONS, gameState.party[0]);
if (diegeticMessage) {
  addMessage(diegeticMessage, 'player');
}
// ... proceed to process the action
```

## Dependencies

*   `../types.ts`: For `Action`, `NPC`, `Location`, and `PlayerCharacter` types.
*   `../constants.ts`: For `DIRECTION_VECTORS`, `ITEMS`, `NPCS`, and `LOCATIONS` data used for lookups.
