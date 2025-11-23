
# GiantAncestrySelection Component

## Purpose

The `GiantAncestrySelection.tsx` component is a step in the character creation process specifically for characters of the Goliath race. It allows the player to choose one "Giant Ancestry" benefit from a predefined list. Each benefit grants a unique supernatural boon reflecting their giant heritage.

This component is rendered by `CharacterCreator.tsx` when a player selects "Goliath" as their race and navigates to the `CreationStep.GiantAncestry`.

## Props

*   **`onAncestrySelect: (ancestryBenefitId: GiantAncestryType) => void`**:
    *   **Type**: Function
    *   **Purpose**: A callback function that is invoked when the player confirms their choice of a Giant Ancestry benefit. It passes the `id` (which is a `GiantAncestryType`) of the selected benefit.
    *   **Required**: Yes

*   **`onBack: () => void`**:
    *   **Type**: Function
    *   **Purpose**: A callback function that is invoked when the player clicks the "Back" button. It typically navigates the user to the previous step in the character creation flow (Race Selection).
    *   **Required**: Yes

## State Management

*   **`selectedBenefitId: GiantAncestryType | null`**:
    *   Stores the `id` of the Giant Ancestry benefit currently selected by the player.
    *   Initialized to `null`.
    *   Updated when the player clicks on one of the benefit buttons.

## Core Functionality

1.  **Displaying Benefits**:
    *   The component fetches the list of available `GiantAncestryBenefit` options from `GIANT_ANCESTRIES_DATA` (imported from `src/constants.ts`).
    *   It maps over this data to render a button for each benefit, displaying its name and description.

2.  **Selection Handling**:
    *   When a player clicks on a benefit button, the `selectedBenefitId` state is updated to the ID of that benefit.
    *   The UI visually highlights the selected benefit.

3.  **Submission**:
    *   The "Confirm Ancestry" button is enabled only when a benefit has been selected.
    *   Clicking "Confirm Ancestry" calls the `handleSubmit` function, which in turn invokes the `onAncestrySelect` prop with the `selectedBenefitId`.

4.  **Navigation**:
    *   The "Back to Race" button invokes the `onBack` prop, allowing the user to return to the main race selection screen.

## Data Dependencies

*   **`GIANT_ANCESTRIES_DATA` (from `src/constants.ts`)**: An array of `GiantAncestryBenefit` objects, providing the details for each available boon.

## Styling

*   Styling is handled using Tailwind CSS.
*   Selected benefits are visually distinct from unselected ones.
*   The layout includes a scrollable area if the list of benefits exceeds the available space.

## Accessibility

*   Each benefit button has an `aria-label` for screen readers.
*   The selected state is indicated using `aria-pressed`.
*   Buttons for navigation ("Back", "Confirm") have clear labels.
*   The "Confirm Ancestry" button is `disabled` until a selection is made, providing clear feedback on interactivity.
