# RaceDetailModal Component

## Purpose

The `RaceDetailModal.tsx` component is a dedicated UI element for displaying comprehensive information about a single D&D race within the Character Creator. It is rendered as a modal overlay, invoked by the `RaceSelection.tsx` component. Its primary goal is to provide players with all the necessary details to make an informed choice, including lore, traits, special abilities, and potential sub-options.

A key feature is its use of embedded **Tooltips** for D&D-specific keywords (e.g., "Darkvision," "Fey Ancestry"), which helps educate players on game mechanics.

## Props

*   **`race: Race`**:
    *   **Type**: `Race` object (from `src/types.ts`)
    *   **Purpose**: The data for the specific race to be displayed.
    *   **Required**: Yes

*   **`onSelect: (raceId: string) => void`**:
    *   **Type**: Function
    *   **Purpose**: Callback invoked when the user clicks the "Select [Race Name]" button. It passes the ID of the selected race to the parent component.
    *   **Required**: Yes

*   **`onClose: () => void`**:
    *   **Type**: Function
    *   **Purpose**: Callback invoked when the user clicks the "Back to List" button or the close '×' button, or presses the Escape key.
    *   **Required**: Yes

## Core Functionality

1.  **Modal Display**: Renders a fixed-position overlay with a themed background.
2.  **Image Display**: If the `race.imageUrl` property exists, it displays a visually appealing image of the race.
3.  **Detailed Information**:
    *   Displays the race's full `name` and `description`.
    *   Lists all `traits`.
    *   Conditionally renders sections for `elvenLineages`, `gnomeSubraces`, `giantAncestryChoices`, and `fiendishLegacies` if they exist on the `race` object.
    *   Provides a "Further Choices / Notes" section to inform the player about upcoming decisions related to their chosen race.
4.  **Interactive Tooltips**: The `processDetailTextWithTooltips` helper function scans all displayed text and wraps predefined keywords with a `<Tooltip>` component, making the modal an interactive learning tool.
5.  **Actions**: Includes buttons to confirm the selection (`onSelect`) or close the modal (`onClose`).

## Data Dependencies

*   `src/types.ts`: For `Race` and related types.
*   `../Tooltip.tsx`: For displaying contextual help.

## Styling

*   Uses Tailwind CSS.
*   The modal is designed to be responsive and readable, with a clear layout for dense information.
*   The floated image and wrapping text provide a professional, sourcebook-like feel.

## Accessibility
*   The modal has `aria-modal="true"`, `role="dialog"`, and `aria-labelledby`.
*   All interactive elements (buttons, tooltips) are keyboard accessible and have appropriate `aria-label`s.
