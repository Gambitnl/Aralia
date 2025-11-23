
# Encounter Utilities (`src/utils/encounterUtils.ts`)

## Purpose

The `encounterUtils.ts` module provides centralized helper functions for the procedural encounter generation system. Its responsibilities include calculating the difficulty parameters for an encounter and validating the AI's response to ensure it adheres to gameplay rules.

This module acts as the "business logic" layer for encounter generation, preparing the necessary inputs for the AI and then sanitizing the AI's output before it's presented to the player.

## Core Functionality

The module exports two key functions:

### `calculateEncounterParameters(party, currentLocationId, messages): EncounterParameters`

*   **Purpose**: To determine the appropriate difficulty (XP budget) and thematic context for a new encounter based on the current game state.
*   **Parameters**:
    *   `party: TempPartyMember[]`: An array representing the current party composition, including each member's level.
    *   `currentLocationId: string`: The ID of the party's current location.
    *   `messages: GameMessage[]`: A recent slice of the game message log.
*   **Process**:
    1.  **XP Budget Calculation**: It iterates through the party members and sums their "Medium" XP thresholds (from `XP_THRESHOLDS_BY_LEVEL` in `src/data/dndData.ts`) to establish a target total XP value for the encounter.
    2.  **Theme Tag Derivation**: It creates a set of thematic keywords (`string[]`) by:
        *   Identifying the biome of the current location (e.g., `forest`, `cave`).
        *   Scanning the recent game messages for keywords (e.g., "undead," "ruins," "goblin") to add further context.
        *   Adding a fallback tag like `"general"` if no other themes can be derived.
*   **Returns**: An `EncounterParameters` object containing `{ xpBudget: number; themeTags: string[] }`. This object is then used to construct the prompt for `geminiService.generateEncounter`.

### `processAndValidateEncounter(aiSuggestions, themeTags): Monster[]`

*   **Purpose**: To act as a "safety net" for the AI's generated encounter. It validates the AI's output against gameplay rules and substitutes nonsensical suggestions with valid ones.
*   **Parameters**:
    *   `aiSuggestions: Monster[]`: The array of `Monster` objects as suggested by the Gemini API.
    *   `themeTags: string[]`: The thematic tags used for the generation, which are used again for rebuilding if needed.
*   **Process**:
    1.  **Quantity Check**: It first checks if the total number of monsters suggested by the AI exceeds a `MAX_MONSTER_COUNT` constant (e.g., 4).
    2.  **Rebuild Logic**: If the monster count is too high, the function **discards the AI's entire suggestion**. It then uses the original `totalXpBudget` and `themeTags` to programmatically build a *new*, valid encounter from the ground up using the `MONSTERS_DATA` constant. This ensures the final encounter always respects the party size limitations.
    3.  **Substitution Logic**: If the monster quantity is acceptable, it validates each monster name against the `MONSTERS_DATA` constant. If the AI suggests a monster that doesn't exist in the game's data, it finds the closest valid substitute based on Challenge Rating (CR) and replaces it.
*   **Returns**: A new, validated `Monster[]` array that is guaranteed to be playable.

## Encounter Generation Pipeline

These utilities are used in the following sequence within `useGameActions.ts`:
1.  The `GENERATE_ENCOUNTER` action is triggered.
2.  `calculateEncounterParameters` is called to get the `xpBudget` and `themeTags`.
3.  These parameters are passed to `geminiService.generateEncounter`, which prompts the AI.
4.  The raw response from the AI is passed to `processAndValidateEncounter`.
5.  The final, validated encounter is dispatched to the game state and displayed in the `EncounterModal`.

## Dependencies

*   `src/types.ts`: For `PlayerCharacter`, `GameMessage`, `Monster`, etc.
*   `src/data/dndData.ts`: For `XP_THRESHOLDS_BY_LEVEL` and `XP_BY_CR`.
*   `src/constants.ts`: For `LOCATIONS`, `BIOMES`, and `MONSTERS_DATA`.
