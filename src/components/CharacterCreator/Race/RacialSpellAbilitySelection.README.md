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