# CharacterCreator State Module (`src/components/CharacterCreator/state/characterCreatorState.ts`)

## Purpose

The `src/components/CharacterCreator/state/characterCreatorState.ts` module centralizes the core state management logic for the `CharacterCreator.tsx` component. It defines:

1.  **`CreationStep`**: An enum defining all possible steps in the character creation process.
2.  **`CharacterCreationState`**: An interface defining the shape of the state object that holds all data for the character being built.
3.  **`CharacterCreatorAction`**: A TypeScript discriminated union type for all actions that can modify the `CharacterCreationState`. This includes specific action types for race-specific final selections (`RaceSpecificFinalSelectionAction`) and class feature final selections (`ClassFeatureFinalSelectionAction`).
4.  **`initialCharacterCreatorState: CharacterCreationState`**: The default starting state for the character creation process.
5.  **`characterCreatorReducer(state: CharacterCreationState, action: CharacterCreatorAction): CharacterCreationState`**: The main reducer function responsible for all state transitions.
6.  **Helper Functions and Type Guards**: Internal utilities used by the reducer, such as:
    *   `determineNextStepAfterRace`: Logic to decide the next step after a race is chosen.
    *   `getResetStateForNewRace`: Helper to reset dependent state fields when a new race is selected.
    *   `getFieldsToResetOnGoBack`: Helper to reset relevant state fields when navigating backward.
    *   `stepDefinitions`: Defines the previous step for each `CreationStep`, used by the `GO_BACK` action.
    *   `calculateFinalAbilityScores`: Calculates final ability scores considering racial bonuses (primarily used if Point Buy isn't the sole source or for display alongside Point Buy).
    *   `isRaceSpecificFinalSelectionAction`, `isClassFeatureFinalSelectionAction`: Type guards for action handling.
    *   `handleRaceSpecificFinalSelectionAction`, `handleClassFeatureFinalSelectionAction`: Specific action handlers within the reducer.

This module allows `CharacterCreator.tsx` to focus on rendering and orchestrating UI components, while the state logic is cleanly separated and managed here.

## Structure Details

### `CreationStep` Enum
Defines distinct stages like `Race`, `Class`, `AbilityScores`, `HumanSkillChoice`, race-specific sub-choice steps (e.g., `ElvenLineage`, `GiantAncestry`), `NameAndReview`, etc.

### `CharacterCreationState` Interface
Holds all pieces of information gathered during character creation, including `selectedRace`, `selectedClass`, `baseAbilityScores`, `finalAbilityScores`, `selectedSkills`, chosen class features, selected racial options (like `selectedElvenLineageId` or `selectedGiantAncestryBenefitId`), and `characterName`.

### `CharacterCreatorAction` Type
A discriminated union covering all possible state changes, such as:
*   `SET_STEP`
*   `SELECT_RACE`
*   `SELECT_DRAGONBORN_ANCESTRY` (and other race-specific final selections)
*   `SELECT_CLASS`
*   `SET_ABILITY_SCORES`
*   `SELECT_HUMAN_SKILL`
*   `SELECT_SKILLS`
*   `SELECT_FIGHTER_FEATURES` (and other class-specific final selections)
*   `SET_CHARACTER_NAME`
*   `GO_BACK`

### `characterCreatorReducer`
The core of the state management. It uses a `switch` statement (or equivalent logic with type guards) based on `action.type` to determine how to update the state. Key responsibilities include:
*   Updating selected race, class, abilities, skills, features, etc.
*   Determining and setting the next `CreationStep` based on current selections.
*   Handling backward navigation (`GO_BACK`) and resetting appropriate parts of the state to maintain consistency (e.g., if a player goes back from Class selection to Race selection, the chosen class and subsequent selections are cleared).

## Usage

*   **`CharacterCreator.tsx`**:
    *   Imports `characterCreatorReducer`, `initialCharacterCreatorState`, `CreationStep`, and `CharacterCreatorAction`.
    *   Uses these with the `useReducer` hook:
        ```typescript
        const [state, dispatch] = useReducer(characterCreatorReducer, initialCharacterCreatorState);
        ```
    *   The `dispatch` function is used by callback handlers within `CharacterCreator.tsx` (e.g., `handleRaceSelect`, `handleClassSelect`) to trigger state updates by sending actions to the reducer.

## Benefits

*   **Centralized State Logic**: All rules for how the character creation state can change are located in one file.
*   **Improved `CharacterCreator.tsx` Readability**: The main component is less cluttered with state update logic.
*   **Predictable State Transitions**: Actions provide a clear and explicit way to modify state.
*   **Testability**: The `characterCreatorReducer` is a pure function and can be easily unit tested.

## Dependencies
*   `../../../types`: For core game entity types (`Race`, `Class`, `Spell`, `Skill`, etc.).
*   `../../../constants`: For game data (`RACES_DATA`, `CLASSES_DATA`, `SPELLS_DATA`, etc.) used by helper functions or for default values if applicable.
*   `../../../utils/characterUtils`: For `getAbilityModifierValue` (used by `calculateCharacterMaxHp` which is now in the assembly hook, but `calculateFinalAbilityScores` in the reducer uses it if Point Buy wasn't solely used).