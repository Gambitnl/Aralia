# ElvenLineageSelection Component

## Purpose

The `ElvenLineageSelection.tsx` component is a specific step in the character creation process for Elf characters. It allows the player to choose their Elven Lineage (Drow, High Elf, or Wood Elf) from the options provided by their selected Elf race. Additionally, it prompts the player to select a spellcasting ability (Intelligence, Wisdom, or Charisma) for any spells granted by their chosen lineage.

This component is rendered by `CharacterCreator.tsx` when a player selects "Elf" as their race and the character creation flow proceeds to the `CreationStep.ElvenLineage`.

## Props

*   **`lineages: ElvenLineage[]`**:
    *   **Type**: Array of `ElvenLineage` objects (from `src/types.ts`)
    *   **Purpose**: An array containing the available Elven Lineage options for the Elf race, as defined in `ELF_DATA` in `src/data/races/elf.ts`.
    *   **Required**: Yes

*   **`onLineageSelect: (lineageId: ElvenLineageType, spellcastingAbility: AbilityScoreName) => void`**:
    *   **Type**: Function
    *   **Purpose**: A callback function that is invoked when the player confirms their choice of lineage and spellcasting ability. It passes the `id` of the selected lineage and the chosen `AbilityScoreName`.
    *   **Required**: Yes

*   **`onBack: () => void`**:
    *   **Type**: Function
    *   **Purpose**: A callback function that is invoked when the player clicks the "Back" button. It typically navigates the user to the previous step in the character creation flow (Race Selection).
    *   **Required**: Yes

## State Management

*   **`selectedLineageId: ElvenLineageType | null`**:
    *   Stores the `id` of the Elven Lineage currently selected by the player.
    *   Initialized to `null`.
*   **`selectedSpellcastingAbility: AbilityScoreName | null`**:
    *   Stores the `AbilityScoreName` selected by the player for their lineage's spells.
    *   Initialized to `null`.

## Core Functionality

1.  **Displaying Lineages**:
    *   The component receives the `lineages` array as a prop.
    *   It maps over this array to render a button for each lineage, displaying its name, description, and key Level 1 benefits (like granted cantrips or speed increases).

2.  **Selection Handling**:
    *   When a player clicks on a lineage button, the `selectedLineageId` state is updated.
    *   Once a lineage is selected, a section appears allowing the player to choose their spellcasting ability for lineage-granted spells from `RELEVANT_SPELLCASTING_ABILITIES` (Intelligence, Wisdom, Charisma).
    *   Clicking an ability button updates the `selectedSpellcastingAbility` state.

3.  **Submission**:
    *   The "Confirm Lineage" button is enabled only when both a lineage and a spellcasting ability have been selected.
    *   Clicking "Confirm Lineage" calls the `handleSubmit` function, which in turn invokes the `onLineageSelect` prop with the selected lineage ID and spellcasting ability.

4.  **Navigation**:
    *   The "Back to Race" button invokes the `onBack` prop, allowing the user to return to the main race selection screen.

## Data Dependencies

*   **`RELEVANT_SPELLCASTING_ABILITIES` (from `src/constants.ts`)**: An array of `AbilityScoreName` strings, providing the valid options for spellcasting abilities.
*   The `lineages` prop, which is derived from `ELF_DATA` in `src/data/races/elf.ts`.

## Styling

*   Styling is handled using Tailwind CSS.
*   Selected lineage and spellcasting ability buttons are visually distinct.
*   The layout clearly separates the lineage choice from the spellcasting ability choice.

## Accessibility

*   Each lineage and ability button has an `aria-label` and `aria-pressed` state for screen readers.
*   Buttons for navigation ("Back", "Confirm") have clear labels.
*   The "Confirm Lineage" button is `disabled` until all required selections are made.