# CharacterCreator Component

## Purpose

The `CharacterCreator.tsx` component is the central orchestrator for the multi-step character creation process in the Aralia RPG. It guides the user through selecting their character's race, class, ability scores, skills, class-specific features, race-specific choices, and finally naming and reviewing their character.

It now manages its state using a `useReducer` hook with logic extracted into **`src/components/CharacterCreator/state/characterCreatorState.ts`**. The complex logic for validating and assembling the final `PlayerCharacter` object, as well as generating character previews, is encapsulated in the **`useCharacterAssembly` custom hook** (from `src/components/CharacterCreator/hooks/useCharacterAssembly.ts`).

The final `PlayerCharacter` object includes all pre-calculated derived stats (like `darkvisionRange`, final `speed`, `maxHp`, `armorClass`) and fully aggregated spell lists, serving as the single source of truth for these values.

## Visual Reference

![Character creator stepper, current panel, and preview](../../../docs/images/character-creator-steps.svg)

## Structure

The character creation process is divided into several steps, managed by the `CreationStep` enum (now in `characterCreatorState.ts`). The UI for each distinct selection part of a step is handled by dedicated sub-components.

`CharacterCreator.tsx` itself is responsible for:
1.  Maintaining the overall state of the character being built via `useReducer` (using elements from `characterCreatorState.ts`).
2.  Controlling the current `CreationStep`.
3.  Rendering the appropriate step-specific UI component.
4.  Passing data and callback functions (dispatching actions) to child components.
5.  Handling navigation logic (`goBack` dispatches an action handled by the reducer).
6.  Orchestrating the final character assembly and preview generation using the `useCharacterAssembly` hook.
7.  **Animations**: Uses the `framer-motion` library with `AnimatePresence` to create smooth, sliding transitions between each step of the character creation process, enhancing the user experience.

The main steps include:
1.  **Race Selection**
2.  **Race-Specific Selections (Conditional)**
3.  **Class Selection**
4.  **Ability Score Allocation**
5.  **Human Skill Choice (Conditional)**
6.  **Skills Selection**
7.  **Class Features Selection (Conditional)**
8.  **Name and Review**

## Props

*   **`onCharacterCreate: (character: PlayerCharacter) => void`**:
    *   **Type**: Function
    *   **Purpose**: Callback invoked upon completion, receiving the fully assembled `PlayerCharacter` object.
    *   **Required**: Yes
*   **`onExitToMainMenu: () => void`**:
    *   **Type**: Function
    *   **Purpose**: Callback invoked when the "Back to Main Menu" button is clicked.
    *   **Required**: Yes

## State Management (`useReducer`)

*   State logic (reducer, initial state, action types, enums) is now in **`src/components/CharacterCreator/state/characterCreatorState.ts`**.
*   `CharacterCreator.tsx` uses `useReducer` with these imported elements.

## Core Functionality

*   **Step Navigation**: Handler functions dispatch actions. The reducer (in `characterCreatorState.ts`) handles step transitions, including `GO_BACK` logic using `stepDefinitions`.
*   **Data Calculation & Assembly (via `useCharacterAssembly` hook)**:
    *   The `useCharacterAssembly` hook provides:
        *   `assembleAndSubmitCharacter(currentState, name)`: Called by `handleNameAndReviewSubmit` to validate, assemble, and call `onCharacterCreate`.
        *   `generatePreviewCharacter(currentState, name)`: Called by `renderStep()` to provide the `characterPreview` prop to `NameAndReview.tsx`.
    *   This hook encapsulates all complex calculation and aggregation logic (HP, speed, darkvision, spells, skills).
*   **Rendering Steps**: `renderStep()` renders the appropriate component for the current `CreationStep`.

## Benefits of Refactoring
*   **Improved Modularity**: `CharacterCreator.tsx` is smaller and more focused.
*   **Better Separation of Concerns**: State logic is in its own module, and assembly logic is in a dedicated hook.
*   **Enhanced Readability & Maintainability**: Easier to understand and modify specific parts.
*   **Testability**: The reducer and `useCharacterAssembly` hook can be tested more easily.

## Data Dependencies

*   `src/constants.ts`: `RACES_DATA`, `CLASSES_DATA`, `SKILLS_DATA`, `SPELLS_DATA`.
*   `src/components/CharacterCreator/state/characterCreatorState.ts`: For state management.
*   `src/components/CharacterCreator/hooks/useCharacterAssembly.ts`: For character assembly and preview.
*   `src/types.ts`: Core type definitions.
*   `src/utils/characterUtils.ts`: Indirectly via `useCharacterAssembly`.

## Styling

Primarily Tailwind CSS.

## Accessibility

Steps are titled; interactive elements in child components should be accessible.