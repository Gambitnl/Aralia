# Social Utilities (`src/utils/socialUtils.ts`)

## Purpose

The `socialUtils.ts` module provides centralized helper functions for social interactions and deception-based mechanics. This includes logic for assessing the plausibility of a player's actions, which is a core part of the "Plausibility & Suspicion" system.

## Functions

### `assessPlausibility(action, character, npcMemory): number`
*   **Purpose**: To determine a Difficulty Class (DC) modifier for a social skill check based on the context of the situation.
*   **Parameters**:
    *   `action: Action`: The action being attempted (e.g., a deception).
    *   `character: PlayerCharacter`: The character performing the action.
    *   `npcMemory`: The target NPC's current memory state, including `disposition` and `suspicion` level.
*   **Logic**:
    *   It starts with a base modifier of 0.
    *   It applies a negative modifier (making the check easier) if the NPC has a high `disposition` towards the player.
    *   It applies a positive modifier (making the check harder) if the NPC has a low `disposition` or is already at a heightened `suspicion` level.
*   **Returns**: A `number` representing the DC modifier. This value is then added to the base DC of the skill check in the action handler.