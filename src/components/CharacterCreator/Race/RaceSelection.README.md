# RaceSelection Component

**File Location:** `src/components/CharacterCreator/RaceSelection.tsx`

## Purpose

The `RaceSelection.tsx` component is the first step in the character creation process, allowing the player to select a race for their character from a list of available D&D races. It presents a grid of simplified race cards, and clicking a card opens a detailed modal (`RaceDetailModal`) for more information.

This component is orchestrated by its parent, `CharacterCreator.tsx`.

## Props

*   **`races: Race[]`**:
    *   **Type**: Array of `Race` objects (from `src/types.ts`).
    *   **Purpose**: An array containing all available race data, passed down from `CharacterCreator.tsx` (which sources it from `RACES_DATA` in `src/constants.ts`).
    *   **Required**: Yes

*   **`onRaceSelect: (raceId: string) => void`**:
    *   **Type**: Function
    *   **Purpose**: A callback function passed down from `CharacterCreator.tsx`. It is invoked when the player confirms their race selection from the detail modal, passing the `id` of the selected race up to the parent to update the character creation state.
    *   **Required**: Yes

## Internal State Management

*   **`viewingRace: Race | null`**:
    *   Stores the `Race` object currently being displayed in the `RaceDetailModal`.
    *   It is initialized to `null`, meaning no modal is visible.
    *   It is updated when the player clicks a "View Details" button on a race card, which triggers the modal to open.

## Core Functionality

1.  **Race Card Display**:
    *   The component receives the `races` array and sorts them alphabetically by name for a consistent and user-friendly display.
    *   It then maps over the sorted array to render a grid of cards, each representing a single race.
    *   Each card shows the race's name and a short, truncated description.
    *   A "View Details" button on each card is the primary interaction, used to open the detailed modal.

2.  **Detail Modal (`RaceDetailModal`)**:
    *   This is a substantial sub-component defined within `RaceSelection.tsx`. When opened, it presents a detailed view of the selected race.
    *   It features **interactive tooltips** for D&D keywords (like "Darkvision" or "Fey Ancestry"), providing players with in-context explanations of game mechanics.
    *   It includes buttons to either confirm the selection (triggering `onRaceSelect`) or close the modal and return to the race list.

## Visual Layout of the `RaceDetailModal`

The detailed modal uses a responsive two-column layout on wider screens to present information clearly:

*   **Left Column**:
    *   Contains the race's artwork at the top.
    *   Below the image is a distinctly styled red box that lists the core **Racial Traits** (e.g., Speed, Size, Darkvision, etc.).
    *   Any fixed **Ability Score Increases** (if applicable to the race) are displayed in a collapsible section below the traits.

*   **Right Column**:
    *   Contains the main lore and **Race Description** in a distinct green box.
    *   Below the description, any further sub-options (like **Elven Lineages**) or notes about upcoming choices are displayed in their own collapsible sections.

This layout separates the mechanical "at-a-glance" traits from the narrative description and sub-options, mirroring the design of modern RPG sourcebooks. On smaller screens, these columns stack vertically to ensure readability.

## Data Dependencies

*   `races` prop, sourced from `RACES_DATA` in `src/constants.ts`.
*   `Tooltip.tsx` and `ImageModal.tsx` for enhanced UI presentations.
*   `types.ts` for the `Race` data structure.

## Accessibility
*   The main container uses `framer-motion` for smooth transitions between creation steps.
*   The `RaceDetailModal` is a fully accessible modal with `aria-modal`, `role="dialog"`, and `aria-labelledby` attributes.
*   All interactive elements (buttons, tooltips) are keyboard accessible and have appropriate `aria-label`s.
