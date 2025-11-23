# Dummy Character Data (`src/data/dev/dummyCharacter.ts`)

## Purpose

The `src/data/dev/dummyCharacter.ts` file is responsible for defining and initializing the `DUMMY_CHARACTER_FOR_DEV`. This dummy character is used during development to bypass the character creation process and quickly jump into the game's `PLAYING` phase for testing and iteration.

This module also defines the `USE_DUMMY_CHARACTER_FOR_DEV` boolean flag, which controls whether the dummy character is used.

## Structure

The file exports:

1.  **`USE_DUMMY_CHARACTER_FOR_DEV: boolean`**:
    *   A flag that, when `true`, instructs `App.tsx` to skip character creation and use `DUMMY_CHARACTER_FOR_DEV`.
    *   Set to `true` for development, should ideally be `false` for production builds or when character creation needs to be tested.

2.  **`initializeDummyCharacterData(allRaces, allClasses, allSkills): PlayerCharacter | null`**:
    *   A function that takes the aggregated `RACES_DATA`, `CLASSES_DATA`, and `SKILLS_DATA` as input.
    *   It constructs and returns a complete `PlayerCharacter` object for the dummy character. This includes setting base ability scores, selecting a race and class, calculating final scores, choosing skills, a fighting style, and determining derived stats like HP and darkvision.
    *   This function is called by `src/constants.ts` after `RACES_DATA`, `CLASSES_DATA`, and `SKILLS_DATA` have been loaded and aggregated, to avoid circular dependency issues at module load time.

3.  **`DUMMY_CHARACTER_FOR_DEV: PlayerCharacter | null`**:
    *   An `export let` variable that holds the initialized dummy character object.
    *   It is initially `null` and then populated by `src/constants.ts` calling `setInitializedDummyCharacter`.

4.  **`setInitializedDummyCharacter(character: PlayerCharacter | null): void`**:
    *   A simple setter function used by `src/constants.ts` to assign the fully initialized dummy character to the `DUMMY_CHARACTER_FOR_DEV` export.

Internal helper constants (like `DUMMY_BASE_ABILITY_SCORES`) and functions (like `calculateDummyFinalScores`) used to build the dummy character are also defined within this module. The `getAbilityModifierValue` function for numerical modifier calculation is now imported from `src/utils/characterUtils.ts`.

## Initialization Flow

1.  `src/constants.ts` imports `initializeDummyCharacterData` and `setInitializedDummyCharacter` from this file.
2.  `src/constants.ts` first defines/imports `RACES_DATA`, `CLASSES_DATA`, and `SKILLS_DATA`.
3.  Then, `src/constants.ts` calls `initializeDummyCharacterData` with the loaded game data.
4.  The result (the dummy character object) is passed to `setInitializedDummyCharacter`, which updates the `DUMMY_CHARACTER_FOR_DEV` variable in this module.
5.  Finally, `src/constants.ts` re-exports `DUMMY_CHARACTER_FOR_DEV` and `USE_DUMMY_CHARACTER_FOR_DEV`.

This ensures that the dummy character is constructed using the actual game data it depends on, mitigating issues with load order or undefined data during its creation.

## Usage

*   **`src/constants.ts`**: Imports and re-exports `DUMMY_CHARACTER_FOR_DEV` and `USE_DUMMY_CHARACTER_FOR_DEV` for global access. It also orchestrates the initialization of `DUMMY_CHARACTER_FOR_DEV`.
*   **`App.tsx`**: Uses `USE_DUMMY_CHARACTER_FOR_DEV` and `DUMMY_CHARACTER_FOR_DEV` to determine the initial game phase and player character when the application loads.

## Modifying the Dummy Character

To change the dummy character's race, class, stats, or other properties:
1.  Modify the hardcoded values within `initializeDummyCharacterData` in `src/data/dev/dummyCharacter.ts` (e.g., `DUMMY_RACE_ID`, `DUMMY_CLASS_ID`, `DUMMY_BASE_ABILITY_SCORES`).
2.  Ensure that any referenced race IDs, class IDs, or skill IDs exist in the respective data files (`RACES_DATA`, `CLASSES_DATA`, `SKILLS_DATA` which are passed into the initialization function).