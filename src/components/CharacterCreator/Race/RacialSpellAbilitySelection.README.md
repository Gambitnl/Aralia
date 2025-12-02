# RacialSpellAbilitySelection Component

## Purpose

The `RacialSpellAbilitySelection.tsx` component is a generic, reusable component created to handle any scenario where a character race needs to select a spellcasting ability (Intelligence, Wisdom, or Charisma) for one of its racial traits.

This component is the cornerstone of the refactor described in `docs/improvements/01_consolidate_repetitive_components.md`. It replaces numerous individual components (like `AarakocraSpellcastingAbilitySelection`, `AirGenasiSpellcastingAbilitySelection`, etc.) with a single, data-driven UI.

## Props

*   **`raceName: string`**:
    *   The name of the race (e.g., "Aarakocra"). Used for display in the component's title.
*   **`traitName: string`**:
    *   The name of the racial trait that grants the spellcasting choice (e.g., "Wind Caller"). Also used in the title.
*   **`traitDescription: string`**:
    *   A descriptive paragraph explaining the choice to the player. This is the main instructional text.
*   **`onAbilitySelect: (ability: AbilityScoreName) => void`**:
    *   A callback function passed from `CharacterCreator.tsx` that is invoked when the player confirms their choice.
*   **`onBack: () => void`**:
    *   A callback to navigate back to the previous step in the character creation flow.

## State Management

*   **`selectedAbility: AbilityScoreName | null`**:
    *   Stores the ability score currently selected by the player.
    *   Updated when the player clicks on one of the ability score buttons.

## Core Functionality

1.  **Dynamic Content**: The component renders its title and descriptive text based entirely on the props it receives. It has no hardcoded text related to any specific race.
2.  **Selection UI**: It displays buttons for the three relevant spellcasting abilities (Intelligence, Wisdom, Charisma), which it gets from `RELEVANT_SPELLCASTING_ABILITIES` in `src/constants.ts`.
3.  **Submission**: The "Confirm Ability" button is enabled only when an ability has been selected. Clicking it invokes the `onAbilitySelect` prop.
4.  **Navigation**: The "Back to Race" button invokes the `onBack` prop.

## Usage in `CharacterCreator.tsx`

This component is rendered during the `CreationStep.RacialSpellAbilityChoice`. The `CharacterCreator`'s state now contains a `racialSpellChoiceContext` object. When a race that requires this choice is selected, the reducer populates this context object. `CharacterCreator.tsx` then passes the data from this context object as props to this component.

This approach allows a single component and a single `CreationStep` to handle the logic for over a dozen different races, dramatically simplifying the character creation flow.

---

## Architecture & Design History

This component was created as part of a deliberate architectural initiative to refactor and consolidate repetitive UI components within the Character Creator.

### The Problem

The codebase previously contained numerous, nearly identical components, each responsible for handling the spellcasting ability selection for a single race (e.g., `AarakocraSpellcastingAbilitySelection.tsx`, `AirGenasiSpellcastingAbilitySelection.tsx`, etc.). This led to significant code duplication, making maintenance difficult and scaling cumbersome. Adding a new race with a similar requirement involved creating yet another component, further bloating the codebase.

### The Solution

The solution was to apply the DRY (Don't Repeat Yourself) principle by creating this single, generic, and configurable component. The implementation followed three main phases:

1.  **Creation of a Reusable Component**:
    This component, `RacialSpellAbilitySelection.tsx`, was designed to be data-driven, accepting props for the race name, trait name, and trait description. This allows it to be used for any race that requires a spellcasting ability choice.

2.  **Refactoring of State Management**:
    The character creator's state management (`characterCreatorState.ts`) was updated to support this generic approach. This involved:
    *   Consolidating multiple `CreationStep` enum members into a single `RacialSpellAbilityChoice`.
    *   Adding a `racialSpellChoiceContext` to the state to provide the necessary dynamic data to the component.
    *   Updating the main reducer to populate this context when a relevant race is selected.

3.  **Cleanup of Obsolete Files**:
    The old, individual components were deprecated and removed from the codebase, resulting in a cleaner and more maintainable file structure.