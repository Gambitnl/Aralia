
# Encounter Action Handlers (`handleEncounter.ts`)

## Purpose

The `handleEncounter.ts` module centralizes all functions related to the procedural encounter generation and battle initiation workflow. It manages the entire lifecycle from a player's request to generate an encounter to the start of a combat session on the battle map.

## Functions

### `handleGenerateEncounter(props)`

*   **Purpose**: Manages the `GENERATE_ENCOUNTER` action. This is an asynchronous, multi-step process.
*   **Logic**:
    1.  Dispatches a `GENERATE_ENCOUNTER` action to set the global `isLoading` state.
    2.  Determines the party composition to use for the encounter calculation (prioritizing the `tempParty` from the editor, otherwise using the main `party`).
    3.  Calls `calculateEncounterParameters` (from `encounterUtils.ts`) to determine the appropriate `xpBudget` and `themeTags` based on the party and current game context.
    4.  Calls `GeminiService.generateEncounter` with these parameters. This service uses Google Search grounding for its suggestions.
    5.  Receives the raw AI suggestions and passes them to `processAndValidateEncounter` (from `encounterUtils.ts`). This utility acts as a safety net, ensuring the monster count is reasonable and substituting any unknown monsters with valid ones from the game's data.
    6.  Dispatches `SHOW_ENCOUNTER_MODAL` with the final, validated encounter data, which hides the loading spinner and displays the `EncounterModal` with the results.
    7.  Includes robust `try...catch` block to dispatch `SHOW_ENCOUNTER_MODAL` with an error message if any step fails.

### `handleShowEncounterModal(dispatch, payload)`

*   **Purpose**: A synchronous pass-through function that dispatches the `SHOW_ENCOUNTER_MODAL` action with the provided encounter data or error message.

### `handleHideEncounterModal(dispatch)`

*   **Purpose**: A synchronous pass-through function that dispatches `HIDE_ENCOUNTER_MODAL` to close the encounter details view.

### `handleStartBattleMapEncounter(dispatch, payload)`

*   **Purpose**: Manages the `START_BATTLE_MAP_ENCOUNTER` action, transitioning the game from the encounter modal to the active battle map.
*   **Logic**: Dispatches the action with the monster data. The `appReducer` then handles creating the `CombatCharacter` instances and setting the `gamePhase` to `BATTLE_MAP_DEMO` (or a future `COMBAT` phase).

### `handleEndBattle(dispatch)`

*   **Purpose**: Manages the `END_BATTLE` action.
*   **Logic**: Dispatches the action to reset combat-related state and return the game phase to `PLAYING`.

## Dependencies
*   `geminiService.ts`: For `generateEncounter`.
*   `encounterUtils.ts`: For calculating parameters and validating AI output.
*   `combatUtils.ts`: Used by the reducer (not directly here) to create `CombatCharacter` instances.
*   `../types.ts`: For `ShowEncounterModalPayload`, etc.
